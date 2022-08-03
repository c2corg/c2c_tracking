import dayjs from 'dayjs';
import pino from 'pino';

import { NotFoundError } from '../../errors';
import type { Activity, Vendor } from '../../repository/activity';
import { activityRepository } from '../../repository/activity.repository';
import type { GarminInfo } from '../../repository/user';
import { userRepository } from '../../repository/user.repository';
import { userService } from '../../user.service';

import { GarminActivity, garminApi as api, GarminAuth, GarminSample } from './api';

const log = pino();

export class GarminService {
  readonly subscriptionUrl: string;

  constructor() {
    this.subscriptionUrl = process.env['FRONTEND_SUBSCRIPTION_URL']!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  }

  async requestUnauthorizedRequestToken(): Promise<GarminAuth> {
    return await api.requestUnauthorizedRequestToken();
  }

  async requestAccessTokenAndSetupUser(
    c2cId: number,
    requestToken: string,
    requestTokenSecret: string,
    verifier: string,
  ): Promise<void> {
    const auth = await api.exchangeToken(requestToken, requestTokenSecret, verifier);
    await this.setupUser(c2cId, auth);
  }

  async setupUser(c2cId: number, auth: GarminAuth): Promise<void> {
    try {
      await userService.configureGarmin(c2cId, auth);
      // retrieve activities from last 7 days
      const now = dayjs();
      const activities: GarminActivity[] = (
        await Promise.allSettled(
          [...Array(7).keys()]
            .map((i) => now.subtract(i, 'day').toDate())
            .flatMap(async (date) => await api.getActivitiesForDay(date, auth.token, auth.tokenSecret)),
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
      await userService.addActivities(
        c2cId,
        ...activities
          .map((activity) => {
            const geojson = this.toGeoJSON(activity.samples);
            return {
              ...{
                vendor: 'garmin' as Vendor,
                vendorId: activity.activityId.toString(),
                date: dayjs.unix(activity.summary.startTimeInSeconds).format(),
                name: '',
                type: activity.summary.activityType,
              },
              ...(geojson && { geojson }),
            };
          })
          .filter(({ geojson }) => !!geojson),
      );
    } catch (err: unknown) {
      if (err instanceof Object) {
        log.error(err);
      }
    }
  }

  private isFullfilled = (
    settled: PromiseSettledResult<GarminActivity[]>,
  ): settled is PromiseFulfilledResult<GarminActivity[]> => settled.status === 'fulfilled';

  private toGeoJSON(samples?: GarminSample[]): GeoJSON.LineString | undefined {
    if (!samples?.length) {
      return undefined;
    }
    let coordinates = samples
      .map((sample) => [
        sample.longitudeInDegree!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
        sample.latitudeInDegree!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
        sample.elevationInMeters || 0,
        sample.startTimeInSeconds!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
      ])
      .filter(([lng, lat]) => !!lng && !!lat);

    if (coordinates.every(([_lng, _lat, alt]) => !alt)) {
      coordinates = coordinates.map((coordinate) => [coordinate[0]!, coordinate[1]!, coordinate[2]!]); // eslint-disable-line @typescript-eslint/no-non-null-assertion
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

    await api.deauthorize(auth.token, auth.tokenSecret);

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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      activityMap.get(user.c2cId)!.push({
        ...{
          vendor: 'garmin',
          vendorId: activity.activityId.toString(),
          date: dayjs.unix(activity.summary.startTimeInSeconds).format(),
          name: '',
          type: activity.summary.activityType,
        },
        ...(geojson && { geojson }),
      });
    }
    for (const [c2cId, activities] of activityMap) {
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
        throw new NotFoundError(`User matching Garmin token ${userAccessToken} not found`);
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
