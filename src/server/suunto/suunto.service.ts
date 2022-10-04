import dayjs from 'dayjs';
import dayjsPluginUTC from 'dayjs/plugin/utc';

import config from '../../config';
import { NotFoundError } from '../../errors';
import log from '../../helpers/logger';
import type { Activity, Vendor } from '../../repository/activity';
import { activityRepository } from '../../repository/activity.repository';
import { userRepository } from '../../repository/user.repository';
import { userService } from '../../user.service';

import {
  SuuntoAuth,
  Workouts,
  suuntoApi as api,
  workoutTypes,
  WebhookEvent,
  suuntoApi,
  WorkoutSummary,
} from './suunto.api';

dayjs.extend(dayjsPluginUTC);

export class SuuntoService {
  readonly subscriptionUrl: string;
  readonly #suuntoSubscriptionKey: string;
  readonly #suuntoWebhookSubscriptionToken: string;

  constructor() {
    this.subscriptionUrl = config.get('c2c.frontend.baseUrl') + config.get('c2c.frontend.subscriptionPath');
    this.#suuntoSubscriptionKey = config.get('trackers.suunto.subscriptionKey');
    this.#suuntoWebhookSubscriptionToken = config.get('trackers.suunto.webhookSubscriptionToken');
  }

  async requestShortLivedAccessTokenAndSetupUser(c2cId: number, authorizationCode: string): Promise<void> {
    const auth = await api.exchangeToken(authorizationCode);
    await this.setupUser(c2cId, auth);
  }

  private async setupUser(c2cId: number, auth: SuuntoAuth): Promise<void> {
    try {
      await userService.configureSuunto(c2cId, auth);
      // retrieve last 30 outings
      const workouts: Workouts = await api.getWorkouts(auth.access_token, this.#suuntoSubscriptionKey);
      if (!workouts.payload.length) {
        return;
      }
      const activities: Omit<Activity, 'id' | 'userId'>[] = workouts.payload.map((workout) => ({
        ...{
          vendor: 'suunto' as Vendor,
          vendorId: workout.workoutKey,
          date: dayjs(workout.startTime).utc().format(),
          type: workoutTypes[workout.activityId] || 'Unkown',
        },
        ...(workout.workoutName && { name: workout.workoutName }),
      }));
      await userService.addActivities(c2cId, ...activities);
    } catch (err: unknown) {
      log.warn(err);
    }
  }

  async getToken(c2cId: number): Promise<string | undefined> {
    // regenerate auth tokens as needed if expired
    const { accessToken, expiresAt, refreshToken } = (await userService.getSuuntoInfo(c2cId)) ?? {};
    if (accessToken && expiresAt && dayjs.unix(expiresAt).isAfter(dayjs().add(1, 'minute'))) {
      return accessToken;
    }
    if (refreshToken) {
      log.debug('Suunto access token expired, requiring refresh');
      try {
        const auth = await api.refreshAuth(refreshToken);
        await userService.updateSuuntoAuth(c2cId, auth);
        return auth.access_token;
      } catch (error: unknown) {
        log.warn(`Suunto access token refresh failed for user ${c2cId}`);
        return undefined;
      }
    }
    return undefined;
  }

  async getFIT(token: string, vendorId: string): Promise<Uint8Array> {
    return api.getFIT(vendorId, token, this.#suuntoSubscriptionKey);
  }

  async handleWebhookEvent(event: WebhookEvent, authHeader: string | undefined): Promise<void> {
    if (!this.isWebhookHeaderValid(authHeader)) {
      log.warn(`Suunto workout webhook event for Suunto user ${event.username} couldn't be processed: bad auth`);
      return;
    }
    const user = await userRepository.findBySuuntoUsername(event.username);
    if (!user) {
      log.warn(
        `Suunto workout webhook event for Suunto user ${event.username} couldn't be processed: unable to find matching user in DB`,
      );
      return;
    }
    const token = await this.getToken(user.c2cId);
    if (!token) {
      log.warn(
        `Suunto workout webhook event for user ${user.c2cId} couldn't be processed: unable to acquire valid token`,
      );
      return;
    }
    let workout: WorkoutSummary;
    try {
      workout = await suuntoApi.getWorkoutDetails(event.workoutid, token, this.#suuntoSubscriptionKey);
    } catch (error) {
      log.warn(
        `Suunto workout webhook event for user ${user.c2cId} couldn't be processed: unable to retrieve activity data`,
      );
      return;
    }
    try {
      await userService.addActivities(user.c2cId, {
        vendor: 'suunto' as Vendor,
        vendorId: event.workoutid, // corresponds to workout key
        date: dayjs(workout.payload.startTime).utc().format(),
        name: workout.payload.workoutName ?? '',
        type: workoutTypes[workout.payload.activityId] || 'Unknown',
      });
    } catch (error) {
      log.warn(
        `Suunto activity update/creation webhook event for user ${user.c2cId} couldn't be processed: unable to upsert activity data`,
      );
    }
  }

  private isWebhookHeaderValid(authHeader: string | undefined): boolean {
    return authHeader === `Bearer: ${this.#suuntoWebhookSubscriptionToken}`;
  }

  async deauthorize(c2cId: number): Promise<void> {
    const user = await userRepository.findById(c2cId);
    if (!user) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }
    const token = await this.getToken(c2cId);
    if (!token) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }

    await api.deauthorize(token);

    // clear user Suunto activities
    await activityRepository.deleteByUserAndVendor(c2cId, 'suunto');
    // clear user Suunto data
    const { suunto, ...userWithoutData } = user;
    await userRepository.update({ ...userWithoutData });
  }
}

export const suuntoService = new SuuntoService();