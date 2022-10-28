import { toGeoJSON } from '@mapbox/polyline';
import dayjs from 'dayjs';

import config from '../../config';
import { NotFoundError } from '../../errors';
import log from '../../helpers/logger';
import { promTokenRenewalErrorsCounter, promWebhookCounter, promWebhookErrorsCounter } from '../../metrics/prometheus';
import type { Vendor } from '../../repository/activity';
import { activityRepository } from '../../repository/activity.repository';
import type { LineString } from '../../repository/geojson';
import { stravaRepository } from '../../repository/strava.repository';
import { userRepository } from '../../repository/user.repository';
import { userService } from '../../user.service';

import { Activity, StravaAuth, stravaApi, WebhookEvent, Subscription, StreamSet } from './strava.api';

const webhookCallbackUrl = `${config.get('server.baseUrl')}strava/webhook`;

export class StravaService {
  public readonly stravaWebhookSubscriptionVerifyToken: string;

  constructor() {
    this.stravaWebhookSubscriptionVerifyToken = config.get('trackers.strava.webhookSubscriptionVerifyToken');
  }

  public containsRequiredScopes(scopes: string[]): boolean {
    return scopes.some((scope) => ['activity:read', 'activity:read_all'].includes(scope));
  }

  public async requestShortLivedAccessTokenAndSetupUser(c2cId: number, authorizationCode: string): Promise<void> {
    const auth = await stravaApi.exchangeToken(authorizationCode);
    await this.setupUser(c2cId, auth);
  }

  private async setupUser(c2cId: number, auth: StravaAuth): Promise<void> {
    await userService.configureStrava(c2cId, auth);

    try {
      // retrieve last 30 outings
      const activities: Activity[] = await stravaApi.getAthleteActivities(auth.access_token);
      if (!activities.length) {
        return;
      }
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
    } catch (error: unknown) {
      // failing to retrieve activities should not break the registration process
      log.info(`Unable to retrieve Strava activities for user ${c2cId}`);
    }
  }

  public async deauthorize(c2cId: number): Promise<void> {
    const user = await userRepository.findById(c2cId);
    if (!user) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }
    const token = await this.getToken(c2cId);
    if (!token) {
      throw new NotFoundError(`Unable to retrieve token for user ${c2cId}`);
    }

    await stravaApi.deauthorize(token);

    // clear user Strava activities
    await activityRepository.deleteByUserAndVendor(c2cId, 'strava');
    // clear user Strava data
    const { strava, ...userWithoutData } = user;
    await userRepository.update({ ...userWithoutData });
  }

  public async getToken(c2cId: number): Promise<string | undefined> {
    // regenerate auth tokens as needed if expired
    const { accessToken, expiresAt, refreshToken } = (await userService.getStravaInfo(c2cId)) ?? {};
    if (accessToken && expiresAt && dayjs.unix(expiresAt).isAfter(dayjs().add(1, 'minute'))) {
      return accessToken;
    }
    if (refreshToken) {
      log.debug('Strava access token expired, requiring refresh');
      try {
        const auth = await stravaApi.refreshAuth(refreshToken);
        await userService.updateStravaAuth(c2cId, auth);
        return auth.access_token;
      } catch (error: unknown) {
        log.warn(`Strava access token refresh failed for user ${c2cId}`);
      }
    }
    promTokenRenewalErrorsCounter.labels({ vendor: 'strava' }).inc(1);
    // clear token, user needs to log again
    await userService.clearStravaTokens(c2cId);
    return undefined;
  }

  public async getActivityLine(token: string, id: string): Promise<LineString> {
    const { map } = await stravaApi.getActivity(token, id);
    return toGeoJSON(map.polyline || map.summary_polyline);
  }

  public async getActivityStream(token: string, id: string): Promise<StreamSet> {
    return await stravaApi.getActivityStream(token, id);
  }

  public async setupWebhook(): Promise<void> {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      log.warn(`Strava subscription couldn't be requested, maybe another webhook is already registered`);
      return;
    }
    try {
      await stravaRepository.setSubscription(subscription.id);
    } catch (error: unknown) {
      log.warn(`Strava subscription couldn't be stored in DB`);
    }
  }

  public async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    if (!(await this.isWebhookEventvalid(event))) {
      promWebhookErrorsCounter.labels({ vendor: 'strava', cause: 'auth' }).inc(1);
      log.warn(`Invalid webhook event: subscription id ${event.subscription_id} doesn't match`);
      return;
    }
    switch (event.object_type) {
      case 'athlete':
        switch (event.aspect_type) {
          case 'delete':
            event.updates?.['authorized'] === 'false' && (await this.handleAthleteDeleteEvent(event.owner_id));
            break;
          default:
            promWebhookErrorsCounter.labels({ vendor: 'strava', cause: 'not_handled' }).inc(1);
            log.info(`Not handling event athlete/${event.aspect_type}`);
            break;
        }
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
          default:
            promWebhookErrorsCounter.labels({ vendor: 'strava', cause: 'not_handled' }).inc(1);
            break;
        }
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
      promWebhookErrorsCounter.labels({ vendor: 'strava', cause: 'user_not_found' }).inc(1);
      log.warn(
        `Strava athlete deletion webhook event for Strava user ${userStravaId} couldn't be processed: unable to find matching user in DB`,
      );
      return;
    }
    // clear user Strava activities
    await activityRepository.deleteByUserAndVendor(user.c2cId, 'strava');
    // clear user Strava data
    const { strava, ...userWithoutData } = user;
    await userRepository.update({ ...userWithoutData });
    promWebhookCounter.labels({ vendor: 'strava', subject: 'user', event: 'delete' });
  }

  /*
   * On activity creation, retrieve data, then add activity to user's activity (sorting and triaging is handled through
   * user service).
   */
  private async handleActivityCreateEvent(userStravaId: number, activityId: string): Promise<void> {
    const user = await userRepository.findByStravaId(userStravaId);
    if (!user) {
      promWebhookErrorsCounter.labels({ vendor: 'strava', cause: 'user_not_found' }).inc(1);
      log.warn(
        `Strava activity creation webhook event for Strava user ${userStravaId} couldn't be processed: unable to find matching user in DB`,
      );
      return;
    }
    const token = await this.getToken(user.c2cId);
    if (!token) {
      promWebhookErrorsCounter.labels({ vendor: 'strava', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Strava activity creation webhook event for user ${user.c2cId} couldn't be processed: unable to acquire valid token`,
      );
      return;
    }
    let activity: Activity;
    try {
      activity = await stravaApi.getActivity(token, activityId);
    } catch (error: unknown) {
      promWebhookErrorsCounter.labels({ vendor: 'strava', cause: 'processing_failed' }).inc(1);
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
      promWebhookCounter.labels({ vendor: 'strava', subject: 'activity', event: 'create' });
    } catch (error: unknown) {
      promWebhookErrorsCounter.labels({ vendor: 'strava', cause: 'processing_failed' }).inc(1);
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
      promWebhookErrorsCounter.labels({ vendor: 'strava', cause: 'user_not_found' }).inc(1);
      log.warn(
        `Strava activity update webhook event for Strava user ${userStravaId} couldn't be processed: unable to find matching user in DB`,
      );
      return;
    }
    const token = await this.getToken(user.c2cId);
    if (!token) {
      promWebhookErrorsCounter.labels({ vendor: 'strava', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Strava activity update webhook event for user ${user.c2cId} couldn't be processed: unable to acquire valid token`,
      );
      return;
    }
    let activity: Activity;
    try {
      activity = await stravaApi.getActivity(token, activityId);
    } catch (error: unknown) {
      promWebhookErrorsCounter.labels({ vendor: 'strava', cause: 'processing_failed' }).inc(1);
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
      promWebhookCounter.labels({ vendor: 'strava', subject: 'activity', event: 'update' });
    } catch (error: unknown) {
      promWebhookErrorsCounter.labels({ vendor: 'strava', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Strava activity update webhook event for user ${user.c2cId} couldn't be processed: unable to update activity data in DB`,
      );
    }
  }

  private async handleActivityDeleteEvent(activityId: string): Promise<void> {
    try {
      await userService.deleteActivity('strava', activityId);
      promWebhookCounter.labels({ vendor: 'strava', subject: 'activity', event: 'delete' });
    } catch (error: unknown) {
      promWebhookErrorsCounter.labels({ vendor: 'strava', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Strava activity delete webhook event for activity ${activityId} couldn't be processed: unable to delete activity data in DB`,
      );
    }
  }
}

export const stravaService = new StravaService();
