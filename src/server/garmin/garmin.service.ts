import { NotFoundError } from '../../errors.ts';
import log from '../../helpers/logger.ts';
import { formatWithOffset, utcDay } from '../../helpers/time.ts';
import { promWebhookCounter, promWebhookErrorsCounter } from '../../metrics/prometheus.ts';
import type { NewActivity, NewActivityWithGeometry } from '../../repository/activity.ts';
import { hasGeometry } from '../../repository/activity.ts';
import type { LineString } from '../../repository/geojson.ts';
import { userRepository } from '../../repository/user.repository.ts';
import type { GarminInfo } from '../../repository/user.ts';
import { userService } from '../../user.service.ts';

import type { GarminActivity, GarminAuth, GarminSample } from './garmin.api.ts';
import { garminApi } from './garmin.api.ts';

export class GarminService {
  public async requestUnauthorizedRequestToken(): Promise<GarminAuth> {
    return await garminApi.requestUnauthorizedRequestToken();
  }

  public async requestAccessTokenAndSetupUser(
    c2cId: number,
    requestToken: string,
    requestTokenSecret: string,
    verifier: string,
  ): Promise<void> {
    const auth = await garminApi.exchangeToken(requestToken, requestTokenSecret, verifier);
    await this.setupUser(c2cId, auth);
  }

  private async setupUser(c2cId: number, auth: GarminAuth): Promise<void> {
    await userService.configureGarmin(c2cId, auth);
    // request backfill for activities from last 30 days (async)
    const end = utcDay().end;
    const start = utcDay(30).start;
    void garminApi.backfillActivities(start, end, auth.token, auth.tokenSecret);
  }

  /*
   * Requests Garmin to replay activity webhook notifications for the `days`-day window ending
   * `endDaysAgo` days ago (default: today). Garmin delivers the actual activity data asynchronously
   * via the normal webhook - this only triggers the replay, it does not return activities directly.
   * Garmin caps each request to roughly a 90-day window; scripts/backfill-garmin-activities.ts chunks
   * longer ranges into multiple calls.
   */
  public async requestBackfill(c2cId: number, days: number, endDaysAgo = 0): Promise<void> {
    const auth = await this.getAuth(c2cId);
    if (!auth) {
      throw new NotFoundError(`Unable to retrieve Garmin auth for user ${c2cId}`);
    }
    const end = utcDay(endDaysAgo).end;
    const start = utcDay(endDaysAgo + days).start;
    await garminApi.backfillActivities(start, end, auth.token, auth.tokenSecret);
  }

  private toGeoJSON(samples?: GarminSample[]): LineString | undefined {
    if (!samples?.length) {
      return undefined;
    }
    let coordinates = samples
      .filter((sample) => !!sample.latitudeInDegree && !!sample.longitudeInDegree)
      .map((sample) => {
        const coord: number[] = [sample.longitudeInDegree!, sample.latitudeInDegree!, sample.elevationInMeters || 0];
        if (sample.startTimeInSeconds) {
          coord.push(sample.startTimeInSeconds);
        }
        return coord;
      });

    if (coordinates.every(([_lng, _lat, alt]) => !alt)) {
      coordinates = coordinates.map((coordinate) => [coordinate[0]!, coordinate[1]!, coordinate[2]!]);
    }

    if (!coordinates.length) {
      return undefined;
    }

    return {
      type: 'LineString',
      coordinates,
    };
  }

  public getAuth = async (c2cId: number): Promise<GarminInfo | undefined> => await userService.getGarminInfo(c2cId);

  public async deauthorize(c2cId: number): Promise<void> {
    const user = await userRepository.findById(c2cId);
    if (!user) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }
    const auth = await this.getAuth(c2cId);
    if (!auth) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }

    await garminApi.deauthorize(auth.token, auth.tokenSecret);

    // clear user Garmin activities
    await userService.deleteActivitiesByVendor(c2cId, 'garmin');
    // clear user Garmin data
    const { garmin, ...userWithoutData } = user;
    await userRepository.update({ ...userWithoutData });
  }

  public async handleActivityWebhook(
    activities: (GarminActivity & { userId: string; userAccessToken: string })[],
  ): Promise<void> {
    const activityMap: Map<number, NewActivityWithGeometry[]> = new Map();
    for (const activity of activities) {
      const user = await userRepository.findByGarminToken(activity.userAccessToken);
      if (!user) {
        promWebhookErrorsCounter.labels({ vendor: 'garmin', cause: 'user_not_found' }).inc(1);
        log.warn(
          `Garmin activity webhook event for Garmin token ${activity.userAccessToken} couldn't be processed: unable to find matching user in DB`,
        );
        continue;
      }
      const repositoryActivity: NewActivity = this.asRepositoryActivity(activity);
      if (!hasGeometry(repositoryActivity)) {
        continue;
      }
      if (!activityMap.has(user.c2cId)) {
        activityMap.set(user.c2cId, []);
      }
      activityMap.get(user.c2cId)!.push(repositoryActivity);
    }
    for (const [c2cId, activities] of activityMap) {
      if (!activities.length) {
        continue;
      }
      try {
        await userService.addActivities(c2cId, ...activities);
        promWebhookCounter.labels({ vendor: 'garmin', subject: 'activity', event: 'create' });
      } catch {
        promWebhookErrorsCounter.labels({ vendor: 'garmin', cause: 'processing_failed' }).inc(1);
        log.warn(
          `Garmin activity creation webhook event for user ${c2cId} couldn't be processed: unable to insert activity data`,
        );
      }
    }
  }

  public async handleDeauthorizeWebhook(deregistrations: { userId: string; userAccessToken: string }[]): Promise<void> {
    for (const { userAccessToken } of deregistrations) {
      const user = await userRepository.findByGarminToken(userAccessToken);
      if (!user) {
        promWebhookErrorsCounter.labels({ vendor: 'garmin', cause: 'user_not_found' }).inc(1);
        log.warn(
          `Garmin deauthorize webhook event for Garmin token ${userAccessToken} couldn't be processed: unable to find matching user in DB`,
        );
        continue;
      }
      try {
        // clear user Garmin activities
        await userService.deleteActivitiesByVendor(user.c2cId, 'garmin');
        // clear user Garmin data
        const { garmin, ...userWithoutData } = user;
        await userRepository.update({ ...userWithoutData });
        promWebhookCounter.labels({ vendor: 'garmin', subject: 'user', event: 'delete' });
      } catch {
        promWebhookErrorsCounter.labels({ vendor: 'garmin', cause: 'processing_failed' }).inc(1);
      }
    }
  }

  private asRepositoryActivity(activity: GarminActivity): NewActivity {
    const geojson = this.toGeoJSON(activity.samples);
    return {
      vendor: 'garmin',
      vendorId: activity.activityId.toString(),
      date: formatWithOffset(activity.summary.startTimeInSeconds, activity.summary.startTimeOffsetInSeconds / 60),
      type: activity.summary.activityType,
      ...(activity.summary.distanceInMeters && { length: Math.round(activity.summary.distanceInMeters) }),
      ...(activity.summary.durationInSeconds && { duration: activity.summary.durationInSeconds }),
      ...(activity.summary.totalElevationGainInMeters && {
        heightDiffUp: Math.round(activity.summary.totalElevationGainInMeters),
      }),
      ...(geojson && { geojson }),
    };
  }
}

export const garminService = new GarminService();
