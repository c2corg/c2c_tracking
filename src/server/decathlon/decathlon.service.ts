import dayjs from 'dayjs';
import type { Except } from 'type-fest';

import { NotFoundError } from '../../errors';
import log from '../../helpers/logger';
import { promTokenRenewalErrorsCounter, promWebhookCounter, promWebhookErrorsCounter } from '../../metrics/prometheus';
import type { Activity as RepositoryActivity, Vendor } from '../../repository/activity';
import { activityRepository } from '../../repository/activity.repository';
import type { LineString } from '../../repository/geojson';
import type { DecathlonInfo } from '../../repository/user';
import { userRepository } from '../../repository/user.repository';
import { userService } from '../../user.service';

import { Activity, decathlonApi, DecathlonAuth, WebhookEvent } from './decathlon.api';
import { sports } from './sports';

export class DecathlonService {
  public async requestShortLivedAccessTokenAndSetupUser(c2cId: number, authorizationCode: string): Promise<void> {
    const auth = await decathlonApi.exchangeToken(authorizationCode);
    await this.setupUser(c2cId, auth);
  }

  private async setupUser(c2cId: number, auth: DecathlonAuth): Promise<void> {
    const userId = await decathlonApi.getUserId(auth.access_token);
    // Keep existing webhook if already present
    let webhookId = await decathlonApi.getExistingWebhookSubscription(auth.access_token);
    if (!webhookId) {
      webhookId = await decathlonApi.createWebhookSubscription(userId, auth.access_token);
    }
    await userService.configureDecathlon(c2cId, auth, userId, webhookId);

    try {
      // retrieve last 30 outings
      const activities = await decathlonApi.getActivities(auth.access_token);
      const geometries = (
        await Promise.allSettled(
          activities.map(async (activity) => {
            const fullActivity = await decathlonApi.getActivity(auth.access_token, activity.id);
            return this.retrieveActivityGeometry(fullActivity);
          }),
        )
      ).map((result, i) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, security/detect-object-injection
        log.info(`Unable to retrieve geometry for Decathlon activity ${activities[i]!.id} for user ${c2cId}`);
        return undefined;
      });
      const repositoryActivities = activities
        // eslint-disable-next-line security/detect-object-injection
        .map((activity, i) => ({ activity, geojson: geometries?.[i] }))
        .filter(({ geojson }) => !!geojson)
        .map(({ activity, geojson }) => this.asRepositoryActivity(activity, geojson));
      await userService.addActivities(c2cId, ...repositoryActivities);
    } catch (error: unknown) {
      // not retrieving past activities should not block the registration process
      log.info(`Unable to retrieve Decathlon activities for user ${c2cId}`);
    }
  }

  public async deauthorize(c2cId: number): Promise<void> {
    const user = await userRepository.findById(c2cId);
    if (!user) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }
    if (!user.decathlon) {
      throw new NotFoundError(`No Decathlon auth defined for user ${c2cId}`);
    }
    const token = await this.getTokenImpl(c2cId, user.decathlon);
    if (!token) {
      throw new NotFoundError(`Unable to retrieve token for user ${c2cId}`);
    }

    // ⚠ there is no way (?) to deauthorize, so just clear data and webhook

    // clear webhook
    await decathlonApi.deleteWebhookSubscription(user.decathlon.webhookId, token);
    // clear user Decathlon activities
    await activityRepository.deleteByUserAndVendor(c2cId, 'decathlon');
    // clear user Decathlon data
    const { decathlon, ...userWithoutData } = user;
    await userRepository.update({ ...userWithoutData });
  }

  public async getToken(c2cId: number): Promise<string | undefined> {
    return this.getTokenImpl(c2cId, await userService.getDecathlonInfo(c2cId));
  }

  private async getTokenImpl(c2cId: number, info: DecathlonInfo | undefined): Promise<string | undefined> {
    if (!info) {
      return undefined;
    }
    // regenerate auth tokens as needed if expired
    const { accessToken, expiresAt, refreshToken } = info;
    if (accessToken && expiresAt && dayjs.unix(expiresAt).isAfter(dayjs().add(1, 'minute'))) {
      return accessToken;
    }
    if (refreshToken) {
      log.debug('Decathlon access token expired, requiring refresh');
      try {
        const auth = await decathlonApi.refreshAuth(refreshToken);
        await userService.updateDecathlonAuth(c2cId, auth);
        return auth.access_token;
      } catch (error: unknown) {
        log.warn(`Decathlon access token refresh failed for user ${c2cId}`);
      }
    }
    promTokenRenewalErrorsCounter.labels({ vendor: 'decathlon' }).inc(1);
    // clear token, user needs to log again
    await userService.clearDecathlonTokens(c2cId);
    return undefined;
  }

  private async retrieveActivityGeometry(activity: Activity): Promise<LineString | undefined> {
    try {
      const coordinates = this.locationsToGeoJson(activity);
      return coordinates.length ? { type: 'LineString', coordinates } : undefined;
    } catch (error: unknown) {
      log.info(
        `Unable to retrieve Decathlon geometry for activity ${activity.id}`,
        error instanceof Error ? error : undefined,
      );
      return undefined;
    }
  }

  public async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    switch (event.event.name) {
      case 'activity_create':
        await this.handleActivityCreateEvent(event.user_id, event.event.ressource_id);
        break;
      case 'activity_delete':
        await this.handleActivityDeleteEvent(event.event.ressource_id);
        break;
      default:
        promWebhookErrorsCounter.labels({ vendor: 'decathlon', cause: 'not_handled' }).inc(1);
    }
  }

  /*
   * On activity creation, retrieve data, then add activity to user's activity (sorting and triaging is handled through
   * user service).
   */
  private async handleActivityCreateEvent(userDecathlonId: string, activityId: string): Promise<void> {
    const user = await userRepository.findByDecathlonId(userDecathlonId);
    if (!user) {
      promWebhookErrorsCounter.labels({ vendor: 'decathlon', cause: 'user_not_found' }).inc(1);
      log.warn(
        `Decathlon activity creation webhook event for Decathlon user ${userDecathlonId} couldn't be processed: unable to find matching user in DB`,
      );
      return;
    }
    const token = await this.getTokenImpl(user.c2cId, user.decathlon);
    if (!token) {
      promWebhookErrorsCounter.labels({ vendor: 'decathlon', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Decathlon activity creation webhook event for user ${user.c2cId} couldn't be processed: unable to acquire valid token`,
      );
      return;
    }
    let activity: Activity;
    let geojson: LineString | undefined = undefined;
    try {
      activity = await decathlonApi.getActivity(token, activityId);
      geojson = await this.retrieveActivityGeometry(activity);
      if (!geojson) {
        return;
      }
    } catch (error: unknown) {
      promWebhookErrorsCounter.labels({ vendor: 'decathlon', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Decathlon activity creation webhook event for user ${user.c2cId} couldn't be processed: unable to retrieve activity data`,
      );
      return;
    }
    try {
      await userService.addActivities(user.c2cId, this.asRepositoryActivity(activity, geojson));
      promWebhookCounter.labels({ vendor: 'decathlon', subject: 'activity', event: 'create' });
    } catch (error: unknown) {
      promWebhookErrorsCounter.labels({ vendor: 'decathlon', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Decathlon activity creation webhook event for user ${user.c2cId} couldn't be processed: unable to insert activity data`,
      );
    }
  }

  private async handleActivityDeleteEvent(activityId: string): Promise<void> {
    try {
      await userService.deleteActivity('decathlon', activityId);
      promWebhookCounter.labels({ vendor: 'decathlon', subject: 'activity', event: 'delete' });
    } catch (error: unknown) {
      promWebhookErrorsCounter.labels({ vendor: 'decathlon', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Decathlon activity delete webhook event for activity ${activityId} couldn't be processed: unable to delete activity data in DB`,
      );
    }
  }

  private locationsToGeoJson(activity: Activity): number[][] {
    if (!activity.locations) {
      return [];
    }
    const start = dayjs(activity.startdate).unix();
    return Object.entries(activity.locations)
      .map(([seconds, value]): [number, number, number, number] => {
        const date = start + Number.parseInt(seconds, 10);
        return [value.longitude, value.latitude, value.elevation, date];
      })
      .sort(([_lng1, _lat1, _ele1, d1], [_lng2, _lat2, _ele2, d2]) => d1 - d2);
  }

  private asRepositoryActivity(activity: Activity, geojson?: LineString): Except<RepositoryActivity, 'id' | 'userId'> {
    const sport = sports.find(({ id }) => id === Number.parseInt(activity.sport.substring(11), 10));
    const coordinates = this.locationsToGeoJson(activity);
    let duration = activity.duration;
    if ((duration === undefined || duration === null) && activity.dataSummaries['24']) {
      duration = activity.dataSummaries['24'];
    }
    let elevation = activity.elevation;
    if ((elevation == undefined || elevation === null) && activity.dataSummaries['18']) {
      elevation = activity.dataSummaries['18'];
    }
    const length = activity.dataSummaries['5'];
    return {
      vendor: 'decathlon' as Vendor,
      vendorId: activity.id.toString(),
      date: activity.startdate,
      name: activity.name,
      type: sport?.translatedNames?.['en'] || 'Unknown',
      ...(duration && { duration: Math.round(duration) }),
      ...(elevation && { heightDiffUp: Math.round(elevation) }),
      ...(length && { length: Math.round(length) }),
      ...(coordinates.length && { geojson: { type: 'LineString', coordinates } }),
      ...(geojson && { geojson }),
    };
  }
}

export const decathlonService = new DecathlonService();
