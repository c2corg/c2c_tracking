import dayjs from 'dayjs';
import dayjsPluginUTC from 'dayjs/plugin/utc';

import config from '../../config';
import { NotFoundError } from '../../errors';
import log from '../../helpers/logger';
import { fitToGeoJSON } from '../../helpers/utils';
import { promTokenRenewalErrorsCounter, promWebhookCounter, promWebhookErrorsCounter } from '../../metrics/prometheus';
import { miniatureService } from '../../miniature.service';
import type { NewActivityWithGeometry, Vendor } from '../../repository/activity';
import { activityRepository } from '../../repository/activity.repository';
import type { LineString } from '../../repository/geojson';
import { userRepository } from '../../repository/user.repository';
import { userService } from '../../user.service';

import { SuuntoAuth, WebhookEvent, Workout, WorkoutSummary, Workouts, suuntoApi, workoutTypes } from './suunto.api';

dayjs.extend(dayjsPluginUTC);

export class SuuntoService {
  readonly #suuntoSubscriptionKey: string;
  readonly #suuntoWebhookSubscriptionToken: string;

  constructor() {
    this.#suuntoSubscriptionKey = config.get('trackers.suunto.subscriptionKey');
    this.#suuntoWebhookSubscriptionToken = config.get('trackers.suunto.webhookSubscriptionToken');
  }

  public async requestShortLivedAccessTokenAndSetupUser(c2cId: number, authorizationCode: string): Promise<void> {
    const auth = await suuntoApi.exchangeToken(authorizationCode);
    await this.setupUser(c2cId, auth);
  }

  private async setupUser(c2cId: number, auth: SuuntoAuth): Promise<void> {
    try {
      await userService.configureSuunto(c2cId, auth);
      // retrieve last 30 outings
      const workouts: Workouts = await suuntoApi.getWorkouts(auth.access_token, this.#suuntoSubscriptionKey);
      const geometries = (
        await Promise.allSettled(
          workouts.payload.map((workout) => this.retrieveActivityGeometry(auth.access_token, workout.workoutKey)),
        )
      ).map((result, i) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        // eslint-disable-next-line security/detect-object-injection
        log.info(`Unable to retrieve geometry for Suunto activity ${workouts.payload[i]!.workoutId} for user ${c2cId}`);
        return undefined;
      });

      const activities = workouts.payload
        // eslint-disable-next-line security/detect-object-injection
        .filter((_activity, i) => !!geometries?.[i])
        // eslint-disable-next-line security/detect-object-injection
        .map((activity, i) => this.asRepositoryActivity(activity, geometries[i]!));
      await userService.addActivities(c2cId, ...activities);
    } catch (err: unknown) {
      log.warn(err);
    }
  }

  public async getToken(c2cId: number): Promise<string | undefined> {
    // regenerate auth tokens as needed if expired
    const { accessToken, expiresAt, refreshToken } = (await userService.getSuuntoInfo(c2cId)) ?? {};
    if (accessToken && expiresAt && dayjs.unix(expiresAt).isAfter(dayjs().add(1, 'minute'))) {
      return accessToken;
    }
    if (refreshToken) {
      log.debug('Suunto access token expired, requiring refresh');
      try {
        const auth = await suuntoApi.refreshAuth(refreshToken);
        await userService.updateSuuntoAuth(c2cId, auth);
        return auth.access_token;
      } catch (error: unknown) {
        log.warn(`Suunto access token refresh failed for user ${c2cId}`);
      }
    }
    promTokenRenewalErrorsCounter.labels({ vendor: 'suunto' }).inc(1);
    // clear token, user needs to log again
    await userService.clearSuuntoTokens(c2cId);
    return undefined;
  }

  private async retrieveActivityGeometry(token: string, workoutKey: string): Promise<LineString | undefined> {
    let fit: ArrayBuffer | undefined;
    try {
      fit = await suuntoApi.getFIT(workoutKey.toString(), token, this.#suuntoSubscriptionKey);
    } catch (error: unknown) {
      log.info(`Unable to retrieve Suunto geometry for ${workoutKey}`, error instanceof Error ? error : undefined);
      return undefined;
    }
    const geojson: LineString | undefined = fitToGeoJSON(fit);
    if (!geojson) {
      log.info(`Unable to convert Suunto FIT file to geometry for ${workoutKey}`);
      return undefined;
    }
    return geojson;
  }

  public async handleWebhookEvent(event: WebhookEvent, authHeader: string | undefined): Promise<void> {
    if (!this.isWebhookHeaderValid(authHeader)) {
      promWebhookErrorsCounter.labels({ vendor: 'suunto', cause: 'auth' }).inc(1);
      log.warn(`Suunto workout webhook event for Suunto user ${event.username} couldn't be processed: bad auth`);
      return;
    }
    const user = await userRepository.findBySuuntoUsername(event.username);
    if (!user) {
      promWebhookErrorsCounter.labels({ vendor: 'suunto', cause: 'user_not_found' }).inc(1);
      log.warn(
        `Suunto workout webhook event for Suunto user ${event.username} couldn't be processed: unable to find matching user in DB`,
      );
      return;
    }
    const token = await this.getToken(user.c2cId);
    if (!token) {
      promWebhookErrorsCounter.labels({ vendor: 'suunto', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Suunto workout webhook event for user ${user.c2cId} couldn't be processed: unable to acquire valid token`,
      );
      return;
    }
    let workout: WorkoutSummary;
    let geojson: LineString | undefined = undefined;
    try {
      workout = await suuntoApi.getWorkoutDetails(event.workoutid, token, this.#suuntoSubscriptionKey);
      geojson = await this.retrieveActivityGeometry(token, workout.payload.workoutKey);
      if (!geojson) {
        return;
      }
    } catch (error: unknown) {
      promWebhookErrorsCounter.labels({ vendor: 'suunto', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Suunto workout webhook event for user ${user.c2cId} couldn't be processed: unable to retrieve activity data`,
      );
      return;
    }
    try {
      await userService.addActivities(user.c2cId, this.asRepositoryActivity(workout.payload, geojson));
      promWebhookCounter.labels({ vendor: 'suunto', subject: 'activity', event: 'create' });
    } catch (error: unknown) {
      promWebhookErrorsCounter.labels({ vendor: 'suunto', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Suunto activity update/creation webhook event for user ${user.c2cId} couldn't be processed: unable to upsert activity data`,
      );
    }
  }

  private isWebhookHeaderValid(authHeader: string | undefined): boolean {
    return authHeader === `Bearer ${this.#suuntoWebhookSubscriptionToken}`;
  }

  public async deauthorize(c2cId: number): Promise<void> {
    const user = await userRepository.findById(c2cId);
    if (!user) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }
    const token = await this.getToken(c2cId);
    if (!token) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }

    await suuntoApi.deauthorize(token);

    // clear user Suunto activities
    const miniatures: string[] = [];
    try {
      miniatures.push(...(await activityRepository.getMiniaturesByUserAndVendor(c2cId, 'suunto')));
    } catch (error: unknown) {
      log.warn(`Failed retrieving miniatures info for user ${c2cId} and vendor suunto`);
    }
    await activityRepository.deleteByUserAndVendor(c2cId, 'suunto');
    for (const miniature of miniatures) {
      try {
        await miniatureService.deleteMiniature(miniature);
      } catch (error: unknown) {
        log.warn(`Failed deleting miniature ${miniature}`);
      }
    }
    // clear user Suunto data
    const { suunto, ...userWithoutData } = user;
    await userRepository.update({ ...userWithoutData });
  }

  private asRepositoryActivity(workout: Workout, geojson: LineString): NewActivityWithGeometry {
    return {
      vendor: 'suunto' as Vendor,
      vendorId: workout.workoutKey,
      date: dayjs(workout.startTime).utcOffset(workout.timeOffsetInMinutes).format(),
      type: workoutTypes[workout.activityId] || 'Unknown',
      geojson,
      ...(workout.totalDistance && { length: Math.round(workout.totalDistance) }),
      ...(workout.totalTime && { duration: Math.round(workout.totalTime) }),
      ...(workout.totalAscent && { heightDiffUp: Math.round(workout.totalAscent) }),
      ...(workout.workoutName && { name: workout.workoutName }),
    };
  }
}

export const suuntoService = new SuuntoService();
