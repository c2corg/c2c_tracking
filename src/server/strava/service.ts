import polyline from '@mapbox/polyline';
const { toGeoJSON } = polyline;
import dayjs from 'dayjs';
import pino from 'pino';

import type { Vendor } from '../../repository/activity';
import { activityRepository } from '../../repository/activity.repository';
import { stravaRepository } from '../../repository/strava.repository';
import { userRepository } from '../../repository/user.repository';
import { userService } from '../../user.service';

import { Activity as StravaActivity, StravaAuth, stravaApi as api, stravaApi, WebhookEvent, Subscription } from './api';

const log = pino();

const webhookCallbackUrl = `${process.env['SERVER_BASE_URL']}/strava/webhook`;
export class StravaService {
  readonly subscriptionErrorUrl: string;
  readonly subscriptionSuccessUrl: string;
  readonly stravaWebhookSubscriptionVerifyToken: string;

  constructor() {
    [
      'SERVER_BASE_URL',
      'FRONTEND_BASE_URL',
      'SUBSCRIPTION_ERROR_URL',
      'SUBSCRIPTION_SUCCESS_URL',
      'STRAVA_WEBHOOK_SUBSCRIPTION_VERIFY_TOKEN',
    ].forEach((envvar) => {
      if (!process.env[envvar]) {
        throw new Error(`Missing configuration variable: ${envvar}`);
      }
    });
    this.subscriptionErrorUrl = `${process.env['FRONTEND_BASE_URL']}/${process.env['SUBSCRIPTION_ERROR_URL']}`;
    this.subscriptionSuccessUrl = `${process.env['FRONTEND_BASE_URL']}/${process.env['SUBSCRIPTION_SUCCESS_URL']}`;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.stravaWebhookSubscriptionVerifyToken = process.env['STRAVA_WEBHOOK_SUBSCRIPTION_VERIFY_TOKEN']!;
  }

  containsRequiredScopes(scopes: string[]): boolean {
    return scopes.some((scope) => ['activity:read', 'activity:read_all'].includes(scope));
  }

  async requestShortLivedAccessTokenAndSetupUser(c2cId: number, authorizationCode: string): Promise<void> {
    const token = await api.exchangeTokens(authorizationCode);
    this.setupUser(c2cId, token); // do this asynchronously
  }

  async setupUser(c2cId: number, auth: StravaAuth): Promise<void> {
    try {
      // TODO check user exists, check rights?
      // retrieve last 30 outings
      const activities: StravaActivity[] = await api.getAthleteActivities(auth.access_token);
      await userService.configureStrava(c2cId, auth);
      await userService.addActivities(
        c2cId,
        ...activities.map((activity) => ({
          vendor: 'strava' as Vendor,
          vendorId: activity.id,
          date: activity.start_date_local,
          name: activity.name,
          type: activity.type,
        })),
      );
    } catch (err: unknown) {
      if (err instanceof Object) {
        log.error(err);
      }
    }
  }

  async getToken(c2cId: number): Promise<string | undefined> {
    // regenerate auth tokens as needed if expired
    const stravaInfo = await userService.getStravaInfo(c2cId);
    if (stravaInfo?.access_token && dayjs(stravaInfo.expires_at).isAfter(dayjs().subtract(1, 'minute'))) {
      return stravaInfo.access_token;
    }
    if (stravaInfo?.refresh_token) {
      const auth = await api.refreshAuth(stravaInfo.refresh_token);
      await userService.updateStravaAuth(c2cId, auth);
      return stravaInfo.access_token;
    }
    return undefined;
  }

  async getActivityLine(token: string, id: string): Promise<GeoJSON.LineString> {
    const { map } = await stravaApi.getActivity(token, id);
    return toGeoJSON(map.polyline || map.summary_polyline);
  }

  async setupWebhook(): Promise<void> {
    (await this.checkWebhookSubscription()) || this.requestWebhookSubscription();
  }

  private async checkWebhookSubscription(): Promise<boolean> {
    const subscriptionId = await stravaRepository.findSubscription();
    if (!subscriptionId) {
      return false;
    }
    try {
      const subscriptions = await stravaApi.getSubscriptions();
      return subscriptions.some(
        (subscription) => subscription.id === subscriptionId && subscription.callback_url === webhookCallbackUrl,
      );
    } catch (error) {
      log.warn(
        `Strava webhook subscription status couldn't be checked: unable to retrieve current subscription. Assuming not set`,
      );
      return false;
    }
  }

  private async requestWebhookSubscription(): Promise<void> {
    let subscription: Subscription;
    try {
      subscription = await stravaApi.requestSubscriptionCreation(
        webhookCallbackUrl,
        this.stravaWebhookSubscriptionVerifyToken,
      );
    } catch (error) {
      log.warn(`Strava subscription couldn't be requested`);
      return;
    }
    try {
      stravaRepository.setSubscription(subscription.id); // async call
    } catch (error) {
      log.warn(`Strava subscription couldn't stored in DB`);
    }
  }

  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    if (await !this.isWebhookEventvalid(event)) {
      return;
    }
    switch (event.object_type) {
      case 'athlete':
        event.aspect_type === 'delete' && (await this.handleAthleteDeleteEvent(event.owner_id));
        break;
      case 'activity':
        switch (event.aspect_type) {
          case 'create':
            await this.handleActivityCreateEvent(event.owner_id, event.object_id.toString());
            break;
          case 'update':
            await this.handleActivityUpdateEvent(event.owner_id, event.object_id.toString());
            break;
          case 'delete':
            await this.handleActivityDeleteEvent(event.object_id.toString());
            break;
        }
        break;
    }
  }

  private async isWebhookEventvalid(event: WebhookEvent): Promise<boolean> {
    const subscriptionId = await stravaRepository.findSubscription();
    return subscriptionId === event.subscription_id;
  }

  /*
   * On athlete delete event received, it means our app isn't authorized anymore. We should thus clean up all
   * Strava-related data from our DB.
   */
  private async handleAthleteDeleteEvent(userStravaId: number): Promise<void> {
    const user = await userRepository.findByStravaId(userStravaId);
    if (!user) {
      return;
    }
    // clear user Strava activities
    (await activityRepository.findByUser(user.c2cId))
      .filter((activity) => activity.vendor === 'strava')
      .forEach((activity) => activityRepository.delete(activity.id));
    // clear user Strava data
    const { strava, ...userWithoutData } = user;
    await userRepository.update({ ...userWithoutData });
  }

  /*
   * On activity creation, retrieve data, then add activity to user's activity (sorting and triaging is handled through
   * user service).
   */
  private async handleActivityCreateEvent(userStravaId: number, activityId: string): Promise<void> {
    const user = await userRepository.findByStravaId(userStravaId);
    if (!user) {
      log.warn(
        `Strava activity creation webhook event for Strava user ${userStravaId} couldn't be processed: unable to find matching user in DB`,
      );
      return;
    }
    const token = await this.getToken(user.c2cId);
    if (!token) {
      log.warn(
        `Strava activity creation webhook event for user ${user.c2cId} couldn't be processed: unable to acquire valid token`,
      );
      return;
    }
    let activity: StravaActivity;
    try {
      activity = await stravaApi.getActivity(token, activityId);
    } catch (error) {
      log.warn(
        `Strava activity creation webhook event for user ${user.c2cId} couldn't be processed: unable to retrieve activity data`,
      );
      return;
    }
    try {
      await userService.addActivities(user.c2cId, {
        vendor: 'strava',
        vendorId: activityId,
        date: activity.start_date_local,
        name: activity.name,
        type: activity.type,
      });
    } catch (error) {
      log.warn(
        `Strava activity creation webhook event for user ${user.c2cId} couldn't be processed: unable to insert activity data`,
      );
    }
  }

  /*
   * On activity update, retrieve activity data and update DB.
   */
  private async handleActivityUpdateEvent(userStravaId: number, activityId: string): Promise<void> {
    // retrieve activity
    const user = await userRepository.findByStravaId(userStravaId);
    if (!user) {
      log.warn(
        `Strava activity update webhook event for Strava user ${userStravaId} couldn't be processed: unable to find matching user in DB`,
      );
      return;
    }
    const token = await this.getToken(user.c2cId);
    if (!token) {
      log.warn(
        `Strava activity update webhook event for user ${user.c2cId} couldn't be processed: unable to acquire valid token`,
      );
      return;
    }
    let activity: StravaActivity;
    try {
      activity = await stravaApi.getActivity(token, activityId);
    } catch (error) {
      log.warn(
        `Strava activity update webhook event for user ${user.c2cId} couldn't be processed: unable to retrieve activity data`,
      );
      return;
    }
    try {
      await userService.updateActivity(user.c2cId, {
        vendor: 'strava',
        vendorId: activityId,
        date: activity.start_date_local,
        name: activity.name,
        type: activity.type,
      });
    } catch (error) {
      log.warn(
        `Strava activity update webhook event for user ${user.c2cId} couldn't be processed: unable to update activity data in DB`,
      );
    }
  }

  private async handleActivityDeleteEvent(activityId: string): Promise<void> {
    try {
      await userService.deleteActivity('strava', activityId);
    } catch (error) {
      log.warn(
        `Strava activity delete webhook event for activity ${activityId} couldn't be processed: unable to delete activity data in DB`,
      );
    }
  }
}

export const stravaService = new StravaService();
