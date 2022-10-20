import dayjs from 'dayjs';
import dayjsPluginUTC from 'dayjs/plugin/utc';

import config from '../../config';
import { NotFoundError } from '../../errors';
import log from '../../helpers/logger';
import type { Activity, Vendor } from '../../repository/activity';
import { activityRepository } from '../../repository/activity.repository';
import type { LineString } from '../../repository/geojson';
import type { GarminInfo } from '../../repository/user';
import { userRepository } from '../../repository/user.repository';
import { userService } from '../../user.service';

import { GarminActivity, garminApi, GarminAuth, GarminSample } from './garmin.api';

dayjs.extend(dayjsPluginUTC);

export class GarminService {
  readonly subscriptionUrl: string;

  constructor() {
    this.subscriptionUrl = config.get('c2c.frontend.baseUrl') + config.get('c2c.frontend.subscriptionPath');
  }

  async requestUnauthorizedRequestToken(): Promise<GarminAuth> {
    return await garminApi.requestUnauthorizedRequestToken();
  }

  async requestAccessTokenAndSetupUser(
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
    // retrieve activities from last 8 days
    const now = dayjs();
    const activities: GarminActivity[] = (
      await Promise.allSettled(
        [...Array(8).keys()]
          .map((i) => now.subtract(i, 'day').toDate())
          .flatMap(async (date) => await garminApi.getActivitiesForDay(date, auth.token, auth.tokenSecret)),
      )
    )
      .map((result) => {
        if (!this.isFullfilled(result)) {
          log.warn('Unable to retrieve some Garmin activities summary: ' + JSON.stringify(result.reason, null, 2));
        }
        return result;
      })
      .filter(this.isFullfilled)
      .flatMap((result) => result.value);
    if (!activities.length) {
      return;
    }
    try {
      await userService.addActivities(
        c2cId,
        ...activities
          .map((activity) => {
            const geojson = this.toGeoJSON(activity.samples);
            return {
              ...{
                vendor: 'garmin' as Vendor,
                vendorId: activity.activityId.toString(),
                date: dayjs.unix(activity.summary.startTimeInSeconds).utc().format(),
                type: activity.summary.activityType,
              },
              ...(geojson && { geojson }),
            };
          })
          .filter(({ geojson }) => !!geojson),
      );
    } catch (err: unknown) {
      log.warn(err);
    }
  }

  private isFullfilled = (
    settled: PromiseSettledResult<GarminActivity[]>,
  ): settled is PromiseFulfilledResult<GarminActivity[]> => settled.status === 'fulfilled';

  private toGeoJSON(samples?: GarminSample[]): LineString | undefined {
    if (!samples?.length) {
      return undefined;
    }
    let coordinates = samples
      .filter((sample) => !!sample.latitudeInDegree && !!sample.longitudeInDegree)
      .map((sample) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const coord: number[] = [sample.longitudeInDegree!, sample.latitudeInDegree!, sample.elevationInMeters || 0];
        sample.startTimeInSeconds && coord.push(sample.startTimeInSeconds);
        return coord;
      });

    if (coordinates.every(([_lng, _lat, alt]) => !alt)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

  getAuth = async (c2cId: number): Promise<GarminInfo | undefined> => await userService.getGarminInfo(c2cId);

  async deauthorize(c2cId: number): Promise<void> {
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
    await activityRepository.deleteByUserAndVendor(c2cId, 'garmin');
    // clear user Garmin data
    const { garmin, ...userWithoutData } = user;
    await userRepository.update({ ...userWithoutData });
  }

  async handleActivityWebhook(
    activities: (GarminActivity & { userId: string; userAccessToken: string })[],
  ): Promise<void> {
    const activityMap: Map<number, Omit<Activity, 'id' | 'userId'>[]> = new Map();
    for (const activity of activities) {
      const user = await userRepository.findByGarminToken(activity.userAccessToken);
      if (!user) {
        log.warn(
          `Garmin activity webhook event for Garmin token ${activity.userAccessToken} couldn't be processed: unable to find matching user in DB`,
        );
        return;
      }
      if (!activityMap.has(user.c2cId)) {
        activityMap.set(user.c2cId, []);
      }
      const geojson = this.toGeoJSON(activity.samples);
      if (!geojson) {
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      activityMap.get(user.c2cId)!.push({
        ...{
          vendor: 'garmin',
          vendorId: activity.activityId.toString(),
          date: dayjs.unix(activity.summary.startTimeInSeconds).utc().format(),
          name: '',
          type: activity.summary.activityType,
          geojson,
        },
      });
    }
    for (const [c2cId, activities] of activityMap) {
      if (!activities.length) {
        continue;
      }
      try {
        await userService.addActivities(c2cId, ...activities.filter(({ geojson }) => !!geojson));
      } catch (error) {
        log.warn(
          `Garmin activity creation webhook event for user ${c2cId} couldn't be processed: unable to insert activity data`,
        );
      }
    }
  }

  async handleDeauthorizeWebhook(deregistrations: { userId: string; userAccessToken: string }[]): Promise<void> {
    for (const { userAccessToken } of deregistrations) {
      const user = await userRepository.findByGarminToken(userAccessToken);
      if (!user) {
        log.warn(
          `Garmin deauthorize webhook event for Garmin token ${userAccessToken} couldn't be processed: unable to find matching user in DB`,
        );
        continue;
      }
      // clear user Garmin activities
      await activityRepository.deleteByUserAndVendor(user.c2cId, 'garmin');
      // clear user Garmin data
      const { garmin, ...userWithoutData } = user;
      await userRepository.update({ ...userWithoutData });
    }
  }
}

export const garminService = new GarminService();
