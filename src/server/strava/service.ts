import polyline from '@mapbox/polyline';
const { toGeoJSON } = polyline;
import dayjs from 'dayjs';

import config from '../../config';
import { NotFoundError } from '../../errors';
import log from '../../helpers/logger';
import type { Vendor } from '../../repository/activity';
import { activityRepository } from '../../repository/activity.repository';
import type { LineString } from '../../repository/geojson';
import { stravaRepository } from '../../repository/strava.repository';
import { userRepository } from '../../repository/user.repository';
import { userService } from '../../user.service';

import {
  Activity as StravaActivity,
  StravaAuth,
  stravaApi as api,
  stravaApi,
  WebhookEvent,
  Subscription,
  StreamSet,
} from './api';

const webhookCallbackUrl = `${config.get('server.baseUrl')}strava/webhook`;
export class StravaService {
  readonly subscriptionUrl: string;
  readonly stravaWebhookSubscriptionVerifyToken: string;

  constructor() {
    this.subscriptionUrl = config.get('c2c.frontend.baseUrl') + config.get('c2c.frontend.subscriptionPath');
    this.stravaWebhookSubscriptionVerifyToken = config.get('trackers.strava.webhookSubscriptionVerifyToken');
  }

  containsRequiredScopes(scopes: string[]): boolean {
    return scopes.some((scope) => ['activity:read', 'activity:read_all'].includes(scope));
  }

  async requestShortLivedAccessTokenAndSetupUser(c2cId: number, authorizationCode: string): Promise<void> {
    const token = await api.exchangeToken(authorizationCode);
    await this.setupUser(c2cId, token);
  }

  async setupUser(c2cId: number, auth: StravaAuth): Promise<void> {
    try {
      // retrieve last 30 outings
      const activities: StravaActivity[] = await api.getAthleteActivities(auth.access_token);
      await userService.configureStrava(c2cId, auth);
      await userService.addActivities(
        c2cId,
        ...activities.map((activity) => ({
          vendor: 'strava' as Vendor,
          vendorId: activity.id.toString(),
          date: activity.start_date,
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

    // clear user Strava activities
    await activityRepository.deleteByUserAndVendor(c2cId, 'strava');
    // clear user Strava data
    const { strava, ...userWithoutData } = user;
    await userRepository.update({ ...userWithoutData });
  }

  async getToken(c2cId: number): Promise<string | undefined> {
    // regenerate auth tokens as needed if expired
    const { accessToken, expiresAt, refreshToken } = (await userService.getStravaInfo(c2cId)) ?? {};
    if (accessToken && expiresAt && dayjs.unix(expiresAt).isAfter(dayjs().add(1, 'minute'))) {
      return accessToken;
    }
    if (refreshToken) {
      log.debug('Strava access token expired, requiring rfresh');
      const auth = await api.refreshAuth(refreshToken);
      await userService.updateStravaAuth(c2cId, auth);
      return auth.access_token;
    }
    return undefined;
  }

  async getActivityLine(token: string, id: string): Promise<LineString> {
    const { map } = await stravaApi.getActivity(token, id);
    return toGeoJSON(map.polyline || map.summary_polyline);
  }

  async getActivityStream(token: string, id: string): Promise<StreamSet> {
    return await stravaApi.getActivityStream(token, id);
  }

  async setupWebhook(): Promise<void> {
    (await this.checkWebhookSubscription()) || this.requestWebhookSubscription();
  }

  private async checkWebhookSubscription(): Promise<boolean> {
    const subscriptionId = await stravaRepository.findSubscription();
    if (!subscriptionId) {
      log.info('No Strava webhook subscription found in DB');
      return false;
    }
    try {
      const foundCurrent = (await stravaApi.getSubscriptions()).some(
        (subscription) => subscription.id === subscriptionId && subscription.callback_url === webhookCallbackUrl,
      );
      log.info(
        foundCurrent ? 'Found matching Strava webhook subscription' : 'No matching Strava webhook subscription found',
      );
      return foundCurrent;
    } catch (error) {
      log.warn(
        `Strava webhook subscription status couldn't be checked: unable to retrieve current subscription. Assuming not set`,
      );
      return false;
    }
  }

  private async requestWebhookSubscription(): Promise<void> {
    log.info('Requesting new Strava webhook subscription');
    let subscription: Subscription;
    try {
      subscription = await stravaApi.requestSubscriptionCreation(
        webhookCallbackUrl,
        this.stravaWebhookSubscriptionVerifyToken,
      );
    } catch (error) {
      log.warn(`Strava subscription couldn't be requested, maybe another webhook is already registered`);
      return;
    }
    try {
      stravaRepository.setSubscription(subscription.id); // async call
    } catch (error) {
      log.warn(`Strava subscription couldn't be stored in DB`);
    }
  }

  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    if (!(await this.isWebhookEventvalid(event))) {
      return;
    }
    switch (event.object_type) {
      case 'athlete':
        event.aspect_type === 'update' &&
          event.updates?.['authorized'] === 'false' &&
          (await this.handleAthleteDeleteEvent(event.owner_id));
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
    await activityRepository.deleteByUserAndVendor(user.c2cId, 'strava');
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
        date: activity.start_date,
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
        date: activity.start_date,
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
