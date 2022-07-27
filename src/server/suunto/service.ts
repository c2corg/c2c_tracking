import dayjs from 'dayjs';
import pino from 'pino';

import { NotFoundError } from '../../errors';
import type { Vendor } from '../../repository/activity';
import { activityRepository } from '../../repository/activity.repository';
import { userRepository } from '../../repository/user.repository';
import { userService } from '../../user.service';

import { SuuntoAuth, Workouts, suuntoApi as api, workoutTypes, WebhookEvent, WorkoutSummary, suuntoApi } from './api';

const log = pino();

export class SuuntoService {
  readonly subscriptionErrorUrl: string;
  readonly subscriptionSuccessUrl: string;
  readonly #suuntoSubscriptionKey: string;
  readonly #suuntoWebhookSubscriptionToken: string;

  constructor() {
    this.subscriptionErrorUrl = `${process.env['FRONTEND_BASE_URL']}/${process.env['SUBSCRIPTION_ERROR_URL']}`;
    this.subscriptionSuccessUrl = `${process.env['FRONTEND_BASE_URL']}/${process.env['SUBSCRIPTION_SUCCESS_URL']}`;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.#suuntoSubscriptionKey = process.env['SUUNTO_SUBSCRIPTION_KEY']!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.#suuntoWebhookSubscriptionToken = process.env['SUUNTO_WEBHOOK_SUBSCRIPTION_TOKEN']!;
  }

  async requestShortLivedAccessTokenAndSetupUser(c2cId: number, authorizationCode: string): Promise<void> {
    const token = await api.exchangeTokens(authorizationCode);
    this.setupUser(c2cId, token); // do this asynchronously
  }

  private async setupUser(c2cId: number, auth: SuuntoAuth): Promise<void> {
    try {
      // retrieve last 30 outings
      const workouts: Workouts = await api.getWorkouts(auth.access_token, this.#suuntoSubscriptionKey);
      log.info(workouts);
      await userService.configureSuunto(c2cId, auth);
      await userService.addActivities(
        c2cId,
        ...workouts.payload.map((workout) => ({
          vendor: 'suunto' as Vendor,
          vendorId: workout.workoutKey,
          date: dayjs(workout.startTime).format(),
          name: workout.workoutName ?? '',
          type: workoutTypes[workout.activityId] || 'Unkown',
        })),
      );
    } catch (err) {
      log.error(err);
    }
  }

  async getToken(c2cId: number): Promise<string | undefined> {
    // regenerate auth tokens as needed if expired
    const { access_token, expires_at, refresh_token } = (await userService.getSuuntoInfo(c2cId)) ?? {};
    if (access_token && dayjs(expires_at).isAfter(dayjs().subtract(1, 'minute'))) {
      return access_token;
    }
    if (refresh_token) {
      const auth = await api.refreshAuth(refresh_token);
      await userService.updateSuuntoAuth(c2cId, auth);
      return access_token;
    }
    return undefined;
  }

  async handleWebhookEvent(event: WebhookEvent, authHeader: string | undefined): Promise<void> {
    if (await !this.isWebhookHeaderValid(authHeader)) {
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
      workout = await suuntoApi.getWorkoutDetails(token, event.workoutid, this.#suuntoSubscriptionKey);
    } catch (error) {
      log.warn(
        `Suunto workout webhook event for user ${user.c2cId} couldn't be processed: unable to retrieve activity data`,
      );
      return;
    }
    try {
      await userService.addActivities(user.c2cId, {
        vendor: 'suunto' as Vendor,
        vendorId: workout.payload.workoutKey,
        date: dayjs(workout.payload.startTime).format(),
        name: workout.payload.workoutName ?? '',
        type: workoutTypes[workout.payload.activityId] || 'Unkown',
      });
    } catch (error) {
      log.warn(
        `Suunto activity update/creation webhook event for user ${user.c2cId} couldn't be processed: unable to upsert activity data`,
      );
    }
  }

  private async isWebhookHeaderValid(authHeader: string | undefined): Promise<boolean> {
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
    await userRepository.update({ ...userWithoutData }); // !FIXME ok juste en enlevant l'info?
  }
}

export const suuntoService = new SuuntoService();
