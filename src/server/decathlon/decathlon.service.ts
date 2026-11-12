import { NotFoundError } from '../../errors.ts';
import { isExcludedActivityType } from '../../excluded-activity-types.ts';
import log from '../../helpers/logger.ts';
import { epochSeconds, expiresLater } from '../../helpers/time.ts';
import {
  promTokenRenewalErrorsCounter,
  promWebhookCounter,
  promWebhookErrorsCounter,
} from '../../metrics/prometheus.ts';
import type { NewActivityWithGeometry } from '../../repository/activity.ts';
import type { LineString } from '../../repository/geojson.ts';
import { userRepository } from '../../repository/user.repository.ts';
import type { DecathlonInfo } from '../../repository/user.ts';
import { userService } from '../../user.service.ts';

import type { Activity, DecathlonAuth, WebhookEvent } from './decathlon.api.ts';
import { decathlonApi } from './decathlon.api.ts';
import { sports } from './sports.ts';

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
      await this.resyncActivities(c2cId, auth.access_token);
    } catch {
      // not retrieving past activities should not block the registration process
      log.info(`Unable to retrieve Decathlon activities for user ${c2cId}`);
    }
  }

  /*
   * Re-fetches the athlete's most recent activities (and their geometry) from Decathlon and merges them
   * into the user's stored activities. Used both right after linking a Decathlon account, and standalone
   * to backfill activities that failed to sync in the past (scripts/backfill-decathlon-activities.ts).
   * Returns the number of activities that were successfully retrieved and stored.
   */
  public async resyncActivities(c2cId: number, accessToken?: string): Promise<number> {
    const token = accessToken ?? (await this.getToken(c2cId));
    if (!token) {
      throw new NotFoundError(`Unable to retrieve a valid Decathlon token for user ${c2cId}`);
    }
    // retrieve last 30 outings
    const activities = (await decathlonApi.getActivities(token)).filter(
      (activity) => !isExcludedActivityType('decathlon', this.sportName(activity)),
    );
    const geometries = (
      await Promise.allSettled(
        activities.map(async (activity) => {
          const fullActivity = await decathlonApi.getActivity(token, activity.id);
          return this.retrieveActivityGeometry(fullActivity);
        }),
      )
    ).map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      // eslint-disable-next-line security/detect-object-injection
      log.info(`Unable to retrieve geometry for Decathlon activity ${activities[i]!.id} for user ${c2cId}`);
      return undefined;
    });
    const repositoryActivities = activities
      // eslint-disable-next-line security/detect-object-injection
      .filter((_activity, i) => !!geometries?.[i])
      // eslint-disable-next-line security/detect-object-injection
      .map((activity, i) => this.asRepositoryActivity(activity, geometries[i]!));
    await userService.addActivities(c2cId, ...repositoryActivities);
    return repositoryActivities.length;
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
    await userService.deleteActivitiesByVendor(c2cId, 'decathlon');
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
    if (accessToken && expiresAt && expiresLater(expiresAt)) {
      return accessToken;
    }
    if (refreshToken) {
      log.debug('Decathlon access token expired, requiring refresh');
      try {
        const auth = await decathlonApi.refreshAuth(refreshToken);
        await userService.updateDecathlonAuth(c2cId, auth);
        return auth.access_token;
      } catch {
        log.warn(`Decathlon access token refresh failed for user ${c2cId}`);
      }
    }
    promTokenRenewalErrorsCounter.labels({ vendor: 'decathlon' }).inc(1);
    // clear token, user needs to log again
    await userService.clearDecathlonTokens(c2cId);
    return undefined;
  }

  private retrieveActivityGeometry(activity: Activity): LineString | undefined {
    try {
      const coordinates = this.locationsToGeoJson(activity);
      return coordinates.length ? { type: 'LineString', coordinates } : undefined;
    } catch (error: unknown) {
      log.info({ err: error }, `Unable to retrieve Decathlon geometry for activity ${activity.id}`);
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
    let geojson: LineString | undefined;
    try {
      activity = await decathlonApi.getActivity(token, activityId);
      geojson = this.retrieveActivityGeometry(activity);
      if (!geojson) {
        return;
      }
    } catch {
      promWebhookErrorsCounter.labels({ vendor: 'decathlon', cause: 'processing_failed' }).inc(1);
      log.warn(
        `Decathlon activity creation webhook event for user ${user.c2cId} couldn't be processed: unable to retrieve activity data`,
      );
      return;
    }
    try {
      await userService.addActivities(user.c2cId, this.asRepositoryActivity(activity, geojson));
      promWebhookCounter.labels({ vendor: 'decathlon', subject: 'activity', event: 'create' });
    } catch {
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
    } catch {
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
    const start = epochSeconds(activity.startdate);
    return Object.entries(activity.locations)
      .map(([seconds, value]): [number, number, number, number] => {
        const date = start + Number.parseInt(seconds, 10);
        return [value.longitude, value.latitude, value.elevation, date];
      })
      .sort(([_lng1, _lat1, _ele1, d1], [_lng2, _lat2, _ele2, d2]) => d1 - d2);
  }

  private sportName(activity: Activity): string | undefined {
    return sports.find(({ id }) => id === Number.parseInt(activity.sport.substring(11), 10))?.translatedNames['en'];
  }

  private asRepositoryActivity(activity: Activity, geojson: LineString): NewActivityWithGeometry {
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
      vendor: 'decathlon',
      vendorId: activity.id.toString(),
      date: activity.startdate,
      name: activity.name,
      type: this.sportName(activity) || 'Unknown',
      geojson,
      ...(duration && { duration: Math.round(duration) }),
      ...(elevation && { heightDiffUp: Math.round(elevation) }),
      ...(length && { length: Math.round(length) }),
      ...(coordinates.length && { geojson: { type: 'LineString', coordinates } }),
    };
  }
}

export const decathlonService = new DecathlonService();
