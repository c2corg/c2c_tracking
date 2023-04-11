import dayjs from 'dayjs';
import dayjsPluginTimezone from 'dayjs/plugin/timezone';
import dayjsPluginUtc from 'dayjs/plugin/utc';
import type { SetNonNullable, SetRequired } from 'type-fest';

import config from '../../config.js';
import { NotFoundError } from '../../errors.js';
import log from '../../helpers/logger.js';
import { fitToGeoJSON } from '../../helpers/utils.js';
import {
  promTokenRenewalErrorsCounter,
  promWebhookCounter,
  promWebhookErrorsCounter,
} from '../../metrics/prometheus.js';
import { miniatureService } from '../../miniature.service.js';
import type { NewActivityWithGeometry, Vendor } from '../../repository/activity.js';
import { activityRepository } from '../../repository/activity.repository.js';
import type { LineString } from '../../repository/geojson.js';
import type { User } from '../../repository/user.js';
import { userRepository } from '../../repository/user.repository.js';
import { userService } from '../../user.service.js';

import { corosApi, CorosAuth, WebhookEvent, Workout, WorkoutRecords } from './coros.api.js';

dayjs.extend(dayjsPluginUtc);
dayjs.extend(dayjsPluginTimezone);

type UserWithCorosInfo = SetNonNullable<SetRequired<User, 'coros'>, 'coros'>;

const isUserWithCorosInfo = (user: User | undefined): user is UserWithCorosInfo => !!user?.coros;

export class CorosService {
  public async requestAccessTokenAndSetupUser(c2cId: number, authorizationCode: string): Promise<void> {
    const auth = await corosApi.exchangeToken(authorizationCode);
    await this.setupUser(c2cId, auth);
  }

  private async setupUser(c2cId: number, auth: CorosAuth): Promise<void> {
    await userService.configureCoros(c2cId, auth);

    try {
      // retrieve workouts from last 30 days
      const workouts: WorkoutRecords = await corosApi.getWorkouts(
        auth.access_token,
        auth.openId,
        Number.parseInt(dayjs().subtract(30, 'days').format('YYYYMMDD'), 10),
        Number.parseInt(dayjs().format('YYYYMMDD'), 10),
      );
      const geometries = (
        await Promise.allSettled(
          workouts.data.map(
            async (workout) => await this.retrieveWorkoutGeometry(workout, auth.access_token, auth.openId),
          ),
        )
      ).map((result, i) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, security/detect-object-injection
        log.info(`Unable to retrieve geometry for Coros workout ${workouts.data[i]!.labelId} for user ${c2cId}`);
        return undefined;
      });

      const repositoryActivities = workouts.data
        // eslint-disable-next-line security/detect-object-injection
        .filter((_workout, i) => !!geometries?.[i])
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, security/detect-object-injection
        .map((workout, i) => this.asRepositoryActivity(workout, geometries[i]!));
      await userService.addActivities(c2cId, ...repositoryActivities);
    } catch (error: unknown) {
      // failing to retrieve workouts should not break the registration process
      log.info(`Unable to retrieve Coros workouts for user ${c2cId}`);
    }
  }

  private async retrieveWorkoutGeometry(
    workout: Workout,
    accessToken: string,
    corosId: string,
  ): Promise<LineString | undefined> {
    // we do not handle triathlon
    // if fitURL is not present in workout data, try to get it from workout details URL
    let fitUrl: string | undefined = workout.fitUrl;
    if (!fitUrl && !workout.triathlonItemList?.some((item) => item.fitUrl)) {
      try {
        fitUrl = (
          await corosApi.getWorkoutDetails(accessToken, workout.labelId, workout.mode, workout.subMode, corosId)
        )?.data?.fitUrl;
      } catch {
        log.info(`Coros workout FIT URL couldn't be extracted from workout details for ${workout.labelId}`);
      }
    }
    if (!fitUrl) {
      log.info(`Coros workout FIT URL couldn't be extracted from workout details for ${workout.labelId}`);
      return undefined;
    }

    let fit: ArrayBuffer | undefined;
    try {
      fit = await corosApi.getFIT(fitUrl);
    } catch (error: unknown) {
      log.info(
        `Unable to retrieve Coros geometry for ${workout.labelId} (${fitUrl})`,
        error instanceof Error ? error : undefined,
      );
      return undefined;
    }
    const geojson: LineString | undefined = fitToGeoJSON(fit);
    if (!geojson) {
      log.info(`Unable to convert Coros FIT file to geometry for ${workout.labelId} (${fitUrl})`);
      return undefined;
    }
    return geojson;
  }

  public async deauthorize(c2cId: number): Promise<void> {
    const user = await userRepository.findById(c2cId);
    if (!user) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }
    if (!isUserWithCorosInfo(user)) {
      throw new NotFoundError(`Unable to retrieve Coros info for user ${c2cId}`);
    }
    const token = await this.getToken(user);
    if (!token) {
      throw new NotFoundError(`Unable to retrieve Coros info for user ${c2cId}`);
    }

    await corosApi.deauthorize(token);

    // clear user Coros activities
    const miniatures: string[] = [];
    try {
      miniatures.push(...(await activityRepository.getMiniaturesByUserAndVendor(c2cId, 'coros')));
    } catch (error: unknown) {
      log.warn(`Failed retrieving miniatures info for user ${c2cId} and vendor coros`);
    }
    await activityRepository.deleteByUserAndVendor(c2cId, 'coros');
    for (const miniature of miniatures) {
      try {
        await miniatureService.deleteMiniature(miniature);
      } catch (error: unknown) {
        log.warn(`Failed deleting miniature ${miniature}`);
      }
    }
    // clear user Coros data
    const { coros, ...userWithoutData } = user;
    await userRepository.update({ ...userWithoutData });
  }

  private async getToken(user: UserWithCorosInfo): Promise<string | undefined> {
    // regenerate auth tokens as needed if expired
    const { accessToken, expiresAt, refreshToken } = user.coros;
    if (accessToken && expiresAt && dayjs.unix(expiresAt).isAfter(dayjs().add(1, 'minute'))) {
      return accessToken;
    }
    if (refreshToken) {
      log.debug('Coros access token expired, requiring refresh');
      try {
        await corosApi.refreshAuth(refreshToken);
        await userService.resetCorosAuthExpiration(user.c2cId);
        return accessToken;
      } catch (error: unknown) {
        log.warn(`Coros access token refresh failed for user ${user.c2cId}`);
      }
    }
    promTokenRenewalErrorsCounter.labels({ vendor: 'coros' }).inc(1);
    // clear token, user needs to log again
    await userService.clearCorosTokens(user.c2cId);
    return undefined;
  }

  public async handleWebhookEvent(event: WebhookEvent, client: string, secret: string): Promise<void> {
    if (!this.isWebhookEventValid(client, secret)) {
      log.info(`Invalid credentials for Coros wbehook event: received ${client}:${secret}`);
      return;
    }

    const activityMap: Map<number, NewActivityWithGeometry[]> = new Map();
    for (const workout of event.sportDataList) {
      const user = await userRepository.findByCorosId(workout.openId);
      if (!isUserWithCorosInfo(user)) {
        promWebhookErrorsCounter.labels({ vendor: 'coros', cause: 'user_not_found' }).inc(1);
        log.warn(
          `Coros webhook event for openId ${workout.openId} couldn't be processed: unable to find matching user in DB`,
        );
        continue;
      }
      const token = await this.getToken(user);
      if (!token) {
        continue;
      }
      const geometry = await this.retrieveWorkoutGeometry(workout, token, workout.openId);
      if (!geometry) {
        continue;
      }
      if (!activityMap.has(user.c2cId)) {
        activityMap.set(user.c2cId, []);
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      activityMap.get(user.c2cId)!.push(this.asRepositoryActivity(workout, geometry));
    }

    for (const [c2cId, activities] of activityMap) {
      if (!activities.length) {
        continue;
      }
      try {
        await userService.addActivities(c2cId, ...activities);
        promWebhookCounter.labels({ vendor: 'coros', subject: 'activity', event: 'create' });
      } catch (error: unknown) {
        promWebhookErrorsCounter.labels({ vendor: 'coros', cause: 'processing_failed' }).inc(1);
        log.warn(`Coros webhook event for user ${c2cId} couldn't be processed: unable to insert activity data`);
      }
    }
  }

  private isWebhookEventValid(client: string, secret: string): boolean {
    return client === config.get('trackers.coros.clientId') && secret === config.get('trackers.coros.clientSecret');
  }

  private asRepositoryActivity(workout: Workout, geojson: LineString): NewActivityWithGeometry {
    return {
      vendor: 'coros' as Vendor,
      vendorId: workout.labelId,
      date: this.localDate(workout.startTime, workout.startTimezone),
      type: corosApi.getSport(workout.mode, workout.subMode),
      duration: workout.duration,
      geojson,
      ...(workout.distance && { length: Math.round(workout.distance) }), // float in Coros API, integer in DB
    };
  }

  private localDate(time: number, timezone: number): string {
    return dayjs
      .unix(time)
      .utcOffset(timezone * 15)
      .format();
  }
}

export const corosService = new CorosService();
