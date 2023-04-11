import dayjs from 'dayjs';
import dayjsPluginUTC from 'dayjs/plugin/utc';

import config from '../../config.js';
import { NotFoundError } from '../../errors.js';
import log from '../../helpers/logger.js';
import {
  promTokenRenewalErrorsCounter,
  promWebhookCounter,
  promWebhookErrorsCounter,
} from '../../metrics/prometheus.js';
import { miniatureService } from '../../miniature.service';
import type { NewActivityWithGeometry, UpdateActivity, Vendor } from '../../repository/activity.js';
import { activityRepository } from '../../repository/activity.repository';
import type { LineString } from '../../repository/geojson.js';
import { stravaRepository } from '../../repository/strava.repository';
import { userRepository } from '../../repository/user.repository';
import { userService } from '../../user.service';

import {
  Activity,
  AltitudeStream,
  DistanceStream,
  LatLngStream,
  StravaAuth,
  StreamSet,
  TimeStream,
  WebhookEvent,
  stravaApi,
} from './strava.api';

dayjs.extend(dayjsPluginUTC);

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
      const geometries = (
        await Promise.allSettled(
          activities.map((activity) =>
            this.retrieveActivityGeometry(
              auth.access_token,
              activity.id,
              this.localDate(activity.start_date, activity.start_date_local),
            ),
          ),
        )
      ).map((result, i) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, security/detect-object-injection
        log.info(`Unable to retrieve geometry for Strava activity ${activities[i]!.id} for user ${c2cId}`);
        return undefined;
      });

      const repositoryActivities = activities
        // eslint-disable-next-line security/detect-object-injection
        .filter((_activity, i) => !!geometries?.[i])
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, security/detect-object-injection
        .map((activity, i) => this.asNewRepositoryActivity(activity, geometries[i]!));
      await userService.addActivities(c2cId, ...repositoryActivities);
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
    const miniatures: string[] = [];
    try {
      miniatures.push(...(await activityRepository.getMiniaturesByUserAndVendor(c2cId, 'strava')));
    } catch (error: unknown) {
      log.warn(`Failed retrieving miniatures info for user ${c2cId} and vendor strava`);
    }
    await activityRepository.deleteByUserAndVendor(c2cId, 'strava');
    for (const miniature of miniatures) {
      try {
        await miniatureService.deleteMiniature(miniature);
      } catch (error: unknown) {
        log.warn(`Failed deleting miniature ${miniature}`);
      }
    }
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

  private async retrieveActivityGeometry(
    token: string,
    activityId: number,
    startDateLocal: string,
  ): Promise<LineString | undefined> {
    try {
      const stream = await stravaApi.getActivityStream(token, activityId);
      return this.streamSetToGeoJSON(stream, dayjs(startDateLocal).unix());
    } catch (error: unknown) {
      log.info(`Unable to retrieve Strava geometry for ${activityId}`, error instanceof Error ? error : undefined);
      return undefined;
    }
  }

  private streamSetToGeoJSON(stream: StreamSet, startDate: number): LineString | undefined {
    const distanceStream: DistanceStream | undefined = stream.find(StravaService.isDistanceStream);
    const timeStream: TimeStream | undefined = stream.find(StravaService.isTimeStream);
    const latlngStream: LatLngStream | undefined = stream.find(StravaService.isLatLngStream);
    const altStream: AltitudeStream | undefined = stream.find(StravaService.isAltitudeStream);

    if (!distanceStream || !latlngStream) {
      throw new NotFoundError('Available data cannot be converted to a valid geometry');
    }
    if (
      stream.some(({ series_type }) => series_type !== 'distance') ||
      new Set(stream.map(({ original_size }) => original_size)).size > 1
    ) {
      // for now, we cannot handle streams where not everything is synchronized with the distance stream
      throw new NotFoundError('Available data cannot be converted to a valid geometry');
    }

    const layout = altStream ? (timeStream ? 'XYZM' : 'XYZ') : timeStream ? 'XYM' : 'XY';
    const coordinates: number[][] = [];
    for (let i = 0; i < distanceStream.original_size; i++) {
      // eslint-disable-next-line security/detect-object-injection, @typescript-eslint/no-non-null-assertion
      const coordinate: number[] = latlngStream.data[i]!.reverse();
      if (layout.includes('Z')) {
        // eslint-disable-next-line security/detect-object-injection, @typescript-eslint/no-non-null-assertion
        coordinate.push(altStream!.data[i]!);
      }
      if (layout.includes('M')) {
        // eslint-disable-next-line security/detect-object-injection, @typescript-eslint/no-non-null-assertion
        coordinate.push(startDate + timeStream!.data[i]!);
      }
      coordinates.push(coordinate);
    }
    if (coordinates.length < 2) {
      return undefined;
    }
    return {
      type: 'LineString',
      coordinates,
    };
  }

  private static isDistanceStream = (
    stream: DistanceStream | TimeStream | LatLngStream | AltitudeStream,
  ): stream is DistanceStream => stream.type === 'distance';

  private static isTimeStream = (
    stream: DistanceStream | TimeStream | LatLngStream | AltitudeStream,
  ): stream is TimeStream => stream.type === 'time';

  private static isLatLngStream = (
    stream: DistanceStream | TimeStream | LatLngStream | AltitudeStream,
  ): stream is LatLngStream => stream.type === 'latlng';

  private static isAltitudeStream = (
    stream: DistanceStream | TimeStream | LatLngStream | AltitudeStream,
  ): stream is AltitudeStream => stream.type === 'altitude';

  public async setupWebhook(): Promise<void> {
    (await this.checkWebhookSubscription()) || void this.requestWebhookSubscription();
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
    let subscriptionId: number;
    try {
      subscriptionId = await stravaApi.requestSubscriptionCreation(
        webhookCallbackUrl,
        this.stravaWebhookSubscriptionVerifyToken,
      );
    } catch (error: unknown) {
      log.warn(`Strava subscription couldn't be requested, maybe another webhook is already registered`);
      return;
    }
    try {
      await stravaRepository.setSubscription(subscriptionId);
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
            await this.handleActivityCreateEvent(event.owner_id, event.object_id);
            break;
          case 'update':
            await this.handleActivityUpdateEvent(event.owner_id, event.object_id);
            break;
          case 'delete':
            await this.handleActivityDeleteEvent(event.object_id);
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
  private async handleActivityCreateEvent(userStravaId: number, activityId: number): Promise<void> {
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
    let geojson: LineString | undefined = undefined;
    try {
      activity = await stravaApi.getActivity(token, activityId);
      geojson = await this.retrieveActivityGeometry(
        token,
        activityId,
        this.localDate(activity.start_date, activity.start_date_local),
      );
      if (!geojson) {
        return;
      }
    } catch (error: unknown) {
      promWebhookErrorsCounter.labels({ vendor: 'strava', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Strava activity creation webhook event for user ${user.c2cId} couldn't be processed: unable to retrieve activity data`,
      );
      return;
    }
    try {
      await userService.addActivities(user.c2cId, this.asNewRepositoryActivity(activity, geojson));
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
  private async handleActivityUpdateEvent(userStravaId: number, activityId: number): Promise<void> {
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
      await userService.updateActivity(user.c2cId, this.asUpdateRepositoryActivity(activity));
      promWebhookCounter.labels({ vendor: 'strava', subject: 'activity', event: 'update' });
    } catch (error: unknown) {
      promWebhookErrorsCounter.labels({ vendor: 'strava', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Strava activity update webhook event for user ${user.c2cId} couldn't be processed: unable to update activity data in DB`,
      );
    }
  }

  private async handleActivityDeleteEvent(activityId: number): Promise<void> {
    try {
      await userService.deleteActivity('strava', activityId.toString());
      promWebhookCounter.labels({ vendor: 'strava', subject: 'activity', event: 'delete' });
    } catch (error: unknown) {
      promWebhookErrorsCounter.labels({ vendor: 'strava', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Strava activity delete webhook event for activity ${activityId} couldn't be processed: unable to delete activity data in DB`,
      );
    }
  }

  private asNewRepositoryActivity(activity: Activity, geojson: LineString): NewActivityWithGeometry {
    return {
      vendor: 'strava' as Vendor,
      vendorId: activity.id.toString(),
      date: this.localDate(activity.start_date, activity.start_date_local),
      name: activity.name,
      type: activity.sport_type,
      duration: activity.elapsed_time,
      geojson,
      ...(activity.distance && { length: Math.round(activity.distance) }), // float in Strava API, integer in DB
      ...(activity.total_elevation_gain && { heightDiffUp: Math.round(activity.total_elevation_gain) }), // float in Strava API, integer in DB
    };
  }

  private asUpdateRepositoryActivity(activity: Activity): UpdateActivity {
    return {
      vendor: 'strava' as Vendor,
      vendorId: activity.id.toString(),
      date: this.localDate(activity.start_date, activity.start_date_local),
      name: activity.name,
      type: activity.sport_type,
    };
  }

  private localDate(startDateString: string, startDateLocalString: string): string {
    const startDate = dayjs(startDateString);
    const startDateLocal = dayjs(startDateLocalString);
    return startDate.utcOffset(startDateLocal.diff(startDate, 'hours')).format();
  }
}

export const stravaService = new StravaService();
