import { createHmac } from 'crypto';

import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { parse } from 'iso8601-duration';
import invariant from 'tiny-invariant';

import { NotFoundError } from '../../errors';
import log from '../../helpers/logger';
import { fitToGeoJSON } from '../../helpers/utils';
import { promWebhookCounter, promWebhookErrorsCounter } from '../../metrics/prometheus';
import { miniatureService } from '../../miniature.service';
import type { NewActivityWithGeometry, Vendor } from '../../repository/activity';
import { activityRepository } from '../../repository/activity.repository';
import type { LineString } from '../../repository/geojson';
import { polarRepository } from '../../repository/polar.repository';
import { userRepository } from '../../repository/user.repository';
import { userService } from '../../user.service';

import { Exercise, polarApi, WebhookEvent, isWebhookPingEvent } from './polar.api';

dayjs.extend(duration);

export class PolarService {
  public async requestAccessTokenAndSetupUser(c2cId: number, authorizationCode: string): Promise<void> {
    const auth = await polarApi.exchangeToken(authorizationCode);
    await polarApi.registerUser(auth.access_token, auth.x_user_id);
    await userService.configurePolar(c2cId, auth);
  }

  public async deauthorize(c2cId: number): Promise<void> {
    const user = await userRepository.findById(c2cId);
    if (!user) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }
    if (!user.polar) {
      throw new NotFoundError(`Unable to retrieve Polar info for user ${c2cId}`);
    }
    const { token, id: polarId } = user.polar;

    await polarApi.deleteUser(token, polarId);

    // clear user Polar activities
    const miniatures: string[] = [];
    try {
      miniatures.push(...(await activityRepository.getMiniaturesByUserAndVendor(c2cId, 'polar')));
    } catch (error: unknown) {
      log.warn(`Failed retrieving miniatures info for user ${c2cId} and vendor polar`);
    }
    await activityRepository.deleteByUserAndVendor(c2cId, 'polar');
    for (const miniature of miniatures) {
      try {
        await miniatureService.deleteMiniature(miniature);
      } catch (error: unknown) {
        log.warn(`Failed deleting miniature ${miniature}`);
      }
    }
    // clear user Polar data
    const { polar, ...userWithoutData } = user;
    await userRepository.update({ ...userWithoutData });
  }

  public async setupWebhook(): Promise<void> {
    (await this.checkWebhookSubscription()) || this.requestWebhookSubscription();
  }

  private async checkWebhookSubscription(): Promise<boolean> {
    const webhookSecret = await polarRepository.findWebhookSecret();
    if (!webhookSecret) {
      log.info('No Polar webhook subscription found in DB');
      return false;
    }
    try {
      const webhookResponse = (await polarApi.getWebhook()).data;
      if (webhookResponse.length !== 1 || !webhookResponse[0]) {
        log.info('No matching Polar webhook subscription found');
        return false;
      }
      const foundCurrent = webhookResponse[0].url === polarApi.webhookCallbackUrl;
      log.info(
        foundCurrent ? 'Found matching Polar webhook subscription' : 'No matching Polar webhook subscription found',
      );
      return foundCurrent;
    } catch (error: unknown) {
      log.warn(
        `Polar webhook subscription status couldn't be checked: unable to retrieve current subscription. Assuming not set`,
      );
      return false;
    }
  }

  private async requestWebhookSubscription(): Promise<void> {
    log.info('Requesting new Polar webhook subscription');
    let webhookSecret: string;
    try {
      webhookSecret = await polarApi.createWebhook();
    } catch (error: unknown) {
      log.warn(`Polar subscription couldn't be requested, maybe another webhook is already registered`);
      return;
    }
    try {
      await polarRepository.setWebhookSecret(webhookSecret);
    } catch (error: unknown) {
      log.warn(`Polar webhook secret couldn't be stored in DB`);
    }
  }

  public async handleWebhookEvent(event: WebhookEvent, raw: string, signature: string): Promise<void> {
    if (isWebhookPingEvent(event)) {
      // nothing to do
      return;
    }

    const user = await userRepository.findByPolarId(event.user_id);
    if (!user) {
      promWebhookErrorsCounter.labels({ vendor: 'polar', cause: 'user_not_found' }).inc(1);
      log.warn(
        `Polar activity creation webhook event for Polar user ${event.user_id} couldn't be processed: unable to find matching user in DB`,
      );
      return;
    }
    invariant(user.polar, 'Missing polar info');
    const webhookSecret = await polarRepository.findWebhookSecret();
    if (!webhookSecret || !this.isSignatureValid(raw, signature, webhookSecret)) {
      promWebhookErrorsCounter.labels({ vendor: 'polar', cause: 'auth' }).inc(1);
      log.warn(`Invalid Polar webhook event: signature doesn't match`);
      return;
    }

    const exerciseId = event.entity_id;
    let exercise: Exercise;
    try {
      exercise = await polarApi.getExercise(user.polar.token, exerciseId);
    } catch (error: unknown) {
      promWebhookErrorsCounter.labels({ vendor: 'polar', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Polar exercise webhook event for user ${user.c2cId} couldn't be processed: unable to retrieve exercise data`,
      );
      return;
    }
    let fit: ArrayBuffer;
    try {
      fit = await polarApi.getExerciseFit(user.polar.token, exerciseId);
    } catch (error: unknown) {
      promWebhookErrorsCounter.labels({ vendor: 'polar', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Polar exercise webhook event for user ${user.c2cId} couldn't be processed: unable to retrieve exercise FIT data`,
      );
      return;
    }
    const geojson: LineString | undefined = fitToGeoJSON(fit);
    if (!geojson) {
      log.warn(
        `Polar exercise webhook event for user ${user.c2cId} couldn't be processed: unable to convert exercise FIT data to geometry`,
      );
      return;
    }
    try {
      await userService.addActivities(user.c2cId, this.asRepositoryActivity(exercise, geojson));
      promWebhookCounter.labels({ vendor: 'polar', subject: 'activity', event: 'create' });
    } catch (error: unknown) {
      promWebhookErrorsCounter.labels({ vendor: 'polar', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Polar activity creation webhook event for user ${user.c2cId} couldn't be processed: unable to insert activity data`,
      );
    }
  }

  private isSignatureValid(rawEvent: string, signature: string, webhookSecret: string): boolean {
    return signature === createHmac('sha256', webhookSecret).update(rawEvent).digest('hex');
  }

  private asRepositoryActivity(exercise: Exercise, geojson: LineString): NewActivityWithGeometry {
    return {
      vendor: 'polar' as Vendor,
      vendorId: exercise.id,
      date: this.localDate(exercise),
      type: exercise.sport,
      geojson,
      ...(exercise.distance && { length: Math.round(exercise.distance) }), // float in Polar API, integer in DB
      ...(exercise.duration && { duration: this.duration(exercise.duration) }), // ISO8601 duration in Polar API
    };
  }

  private localDate(exercise: Exercise): string {
    const isNegative = exercise.start_time_utc_offset < 0;
    const offset = dayjs
      .duration({
        hours: Math.floor(Math.abs(exercise.start_time_utc_offset) / 60),
        minutes: Math.abs(exercise.start_time_utc_offset) % 60,
      })
      .format('HH:mm');
    return exercise.start_time + (isNegative ? '-' : '+') + offset;
  }

  private duration(duration: string): number {
    return Math.round(dayjs.duration(parse(duration)).asSeconds());
  }
}

export const polarService = new PolarService();
