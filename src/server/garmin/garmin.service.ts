import dayjs from 'dayjs';
import dayjsPluginUTC from 'dayjs/plugin/utc';

import { NotFoundError } from '../../errors';
import log from '../../helpers/logger';
import { promTokenRenewalErrorsCounter, promWebhookCounter, promWebhookErrorsCounter } from '../../metrics/prometheus';
import { miniatureService } from '../../miniature.service';
import { hasGeometry, NewActivity, NewActivityWithGeometry, Vendor } from '../../repository/activity';
import { activityRepository } from '../../repository/activity.repository';
import type { LineString } from '../../repository/geojson';
import type { GarminInfo, User } from '../../repository/user';
import { userRepository } from '../../repository/user.repository';
import { userService } from '../../user.service';

import { GarminActivity, garminApi, GarminAuth, GarminSample } from './garmin.api';

dayjs.extend(dayjsPluginUTC);

export class GarminService {
  public startAuthorization(): { url: string; state: string; codeVerifier: string } {
    const { codeVerifier, codeChallenge } = garminApi.generatePkce();
    const state = garminApi.generateState();
    return { url: garminApi.getAuthorizationUrl(state, codeChallenge), state, codeVerifier };
  }

  public async requestAccessTokenAndSetupUser(
    c2cId: number,
    code: string,
    codeVerifier: string,
    state: string,
  ): Promise<void> {
    const auth = await garminApi.exchangeCode(code, codeVerifier, state);
    await this.setupUser(c2cId, auth);
  }

  private async setupUser(c2cId: number, auth: GarminAuth): Promise<void> {
    const garminUserId = await garminApi.getUserId(auth.access_token);
    await userService.configureGarmin(c2cId, auth, garminUserId);
    // request backfill for activities from last 30 days (async)
    const end = dayjs().utc().endOf('day').unix();
    const start = dayjs().utc().startOf('day').subtract(30, 'day').unix();
    void garminApi.backfillActivities(start, end, auth.access_token).catch((error: unknown) => {
      log.warn(`Garmin backfill request failed for user ${c2cId}`, error instanceof Error ? error : undefined);
    });
  }

  /*
   * Migrates a user linked through OAuth 1 to OAuth 2, by exchanging the OAuth 1 token. Requires Garmin to have
   * enabled OAuth 2 for the application. The user id is read first: it is what identifies the user in webhooks.
   */
  public async migrateLegacyUser(c2cId: number): Promise<void> {
    const info = await this.getAuth(c2cId);
    if (info?.userId) {
      return; // already migrated
    }
    if (!info?.token || !info.tokenSecret) {
      throw new NotFoundError(`User ${c2cId} has no Garmin OAuth 1 credentials`);
    }
    const garminUserId = await garminApi.getLegacyUserId(info.token, info.tokenSecret);
    const auth = await garminApi.exchangeLegacyToken(info.token, info.tokenSecret);
    await userService.configureGarmin(c2cId, auth, garminUserId, true);
  }

  /*
   * Requests Garmin to replay activity webhook notifications for the `days`-day window ending
   * `endDaysAgo` days ago (default: today). Garmin delivers the actual activity data asynchronously
   * via the normal webhook - this only triggers the replay, it does not return activities directly.
   * Garmin caps each request to roughly a 90-day window; scripts/backfill-garmin-activities.ts chunks
   * longer ranges into multiple calls.
   */
  public async requestBackfill(c2cId: number, days: number, endDaysAgo = 0): Promise<void> {
    const accessToken = await this.getAccessToken(c2cId);
    if (!accessToken) {
      throw new NotFoundError(`Unable to retrieve Garmin auth for user ${c2cId}`);
    }
    const end = dayjs().utc().subtract(endDaysAgo, 'day').endOf('day').unix();
    const start = dayjs()
      .utc()
      .subtract(endDaysAgo + days, 'day')
      .startOf('day')
      .unix();
    await garminApi.backfillActivities(start, end, accessToken);
  }

  private toGeoJSON(samples?: GarminSample[]): LineString | undefined {
    if (!samples?.length) {
      return undefined;
    }
    let coordinates = samples
      .filter((sample) => !!sample.latitudeInDegree && !!sample.longitudeInDegree)
      .map((sample) => {
        const coord: number[] = [sample.longitudeInDegree!, sample.latitudeInDegree!, sample.elevationInMeters || 0];
        sample.startTimeInSeconds && coord.push(sample.startTimeInSeconds);
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

  /** Returns a valid access token, refreshing it if needed. `undefined` if the user can't be (or is no longer) authenticated. */
  public async getAccessToken(c2cId: number): Promise<string | undefined> {
    const { accessToken, expiresAt, refreshToken } = (await this.getAuth(c2cId)) ?? {};
    if (accessToken && expiresAt && dayjs.unix(expiresAt).isAfter(dayjs().add(1, 'minute'))) {
      return accessToken;
    }
    if (refreshToken) {
      log.debug('Garmin access token expired, requiring refresh');
      try {
        const auth = await garminApi.refreshAuth(refreshToken);
        await userService.updateGarminAuth(c2cId, auth);
        return auth.access_token;
      } catch (error: unknown) {
        log.warn(`Garmin access token refresh failed for user ${c2cId}`);
      }
    }
    promTokenRenewalErrorsCounter.labels({ vendor: 'garmin' }).inc(1);
    return undefined;
  }

  public async deauthorize(c2cId: number): Promise<void> {
    const user = await userRepository.findById(c2cId);
    if (!user) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }
    if (!user.garmin) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }

    const accessToken = await this.getAccessToken(c2cId);
    if (accessToken) {
      await garminApi.deauthorize(accessToken);
    } else {
      // can't tell Garmin (OAuth 1 user not migrated yet, or expired refresh token): clean up on our side anyway
      log.warn(`No valid Garmin access token for user ${c2cId}: unable to deregister the user on Garmin side`);
    }

    // clear user Garmin activities
    const miniatures: string[] = [];
    try {
      miniatures.push(...(await activityRepository.getMiniaturesByUserAndVendor(c2cId, 'garmin')));
    } catch (error: unknown) {
      log.warn(`Failed retrieving miniatures info for user ${c2cId} and vendor garmin`);
    }
    await activityRepository.deleteByUserAndVendor(c2cId, 'garmin');
    for (const miniature of miniatures) {
      try {
        await miniatureService.deleteMiniature(miniature);
      } catch (error: unknown) {
        log.warn(`Failed deleting miniature ${miniature}`);
      }
    }
    // clear user Garmin data
    const { garmin, ...userWithoutData } = user;
    await userRepository.update({ ...userWithoutData });
  }

  /*
   * Webhooks identify users by their Garmin API user id. Notifications sent before Garmin stops sending the
   * OAuth 1 token also carry `userAccessToken`: it is used as a fallback for the users not migrated yet.
   */
  private async findUser(userId: string, userAccessToken?: string): Promise<User | undefined> {
    return (
      (await userRepository.findByGarminUserId(userId)) ??
      (userAccessToken ? await userRepository.findByGarminToken(userAccessToken) : undefined)
    );
  }

  public async handleActivityWebhook(
    activities: (GarminActivity & { userId: string; userAccessToken?: string })[],
  ): Promise<void> {
    const activityMap: Map<number, NewActivityWithGeometry[]> = new Map();
    for (const activity of activities) {
      const user = await this.findUser(activity.userId, activity.userAccessToken);
      if (!user) {
        promWebhookErrorsCounter.labels({ vendor: 'garmin', cause: 'user_not_found' }).inc(1);
        log.warn(
          `Garmin activity webhook event for Garmin user ${activity.userId} couldn't be processed: unable to find matching user in DB`,
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
      } catch (error: unknown) {
        promWebhookErrorsCounter.labels({ vendor: 'garmin', cause: 'processing_failed' }).inc(1);
        log.warn(
          `Garmin activity creation webhook event for user ${c2cId} couldn't be processed: unable to insert activity data`,
        );
      }
    }
  }

  public async handleDeauthorizeWebhook(
    deregistrations: { userId: string; userAccessToken?: string }[],
  ): Promise<void> {
    for (const { userId, userAccessToken } of deregistrations) {
      const user = await this.findUser(userId, userAccessToken);
      if (!user) {
        promWebhookErrorsCounter.labels({ vendor: 'garmin', cause: 'user_not_found' }).inc(1);
        log.warn(
          `Garmin deauthorize webhook event for Garmin user ${userId} couldn't be processed: unable to find matching user in DB`,
        );
        continue;
      }
      try {
        // clear user Garmin activities
        await activityRepository.deleteByUserAndVendor(user.c2cId, 'garmin');
        // clear user Garmin data
        const { garmin, ...userWithoutData } = user;
        await userRepository.update({ ...userWithoutData });
        promWebhookCounter.labels({ vendor: 'garmin', subject: 'user', event: 'delete' });
      } catch (error: unknown) {
        promWebhookErrorsCounter.labels({ vendor: 'garmin', cause: 'processing_failed' }).inc(1);
      }
    }
  }

  private asRepositoryActivity(activity: GarminActivity): NewActivity {
    const geojson = this.toGeoJSON(activity.samples);
    return {
      vendor: 'garmin' as Vendor,
      vendorId: activity.activityId.toString(),
      date: dayjs
        .unix(activity.summary.startTimeInSeconds)
        .utcOffset(activity.summary.startTimeOffsetInSeconds / 60)
        .format(),
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
