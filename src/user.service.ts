import dayjs from 'dayjs';
import pino from 'pino';

import { NotFoundError } from './errors';
import type { Activity, Vendor } from './repository/activity';
import { activityRepository } from './repository/activity.repository';
import type { GarminInfo, StravaInfo, SuuntoInfo, User } from './repository/user';
import { userRepository } from './repository/user.repository';
import type { GarminAuth } from './server/garmin/api';
import type { StravaAuth, StravaRefreshAuth } from './server/strava/api';
import type { SuuntoAuth, SuuntoRefreshAuth } from './server/suunto/api';

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

const MAX_ACTIVITIES_PER_USER = 30;

const log = pino();

const byDate = (a1: Optional<Activity, 'id'>, a2: Optional<Activity, 'id'>): number => {
  const d1 = dayjs(a1.date);
  const d2 = dayjs(a2.date);
  return d1.isSame(d2, 'second') ? 0 : d1.isBefore(d2) ? -1 : 1;
};

const isInDb = (activity: Optional<Activity, 'id'>): activity is Activity => !!activity.id;

const isActivityToUpdate = (
  activity: Optional<Activity, 'id'> & {
    update?: boolean;
  },
): activity is Activity & {
  update?: boolean;
} => !!activity.id && !!activity.update;

export class UserService {
  async getUserInfo(c2cId: number): Promise<{ [key in Vendor]?: boolean }> {
    const { strava, suunto, garmin } = (await userRepository.findById(c2cId)) || {};
    return {
      strava: !!strava,
      suunto: !!suunto,
      garmin: !!garmin,
    };
  }

  async configureStrava(c2cId: number, auth: StravaAuth): Promise<void> {
    let user: User | undefined = await userRepository.findById(c2cId);
    if (user) {
      user = {
        ...user,
        strava: {
          id: auth.athlete.id,
          accessToken: auth.access_token,
          expiresAt: auth.expires_at,
          refreshToken: auth.refresh_token,
        },
      };
      await userRepository.update(user);
    } else {
      user = {
        c2cId,
        strava: {
          id: auth.athlete.id,
          accessToken: auth.access_token,
          expiresAt: auth.expires_at,
          refreshToken: auth.refresh_token,
        },
      };
      await userRepository.insert(user);
    }
  }

  async updateStravaAuth(c2cId: number, auth: StravaRefreshAuth): Promise<void> {
    let user: User | undefined = await userRepository.findById(c2cId);
    if (!user) {
      throw new NotFoundError(`User ${c2cId} not found in db`);
    }
    if (!user.strava || !user.strava.id) {
      throw new NotFoundError('User ${c2cId} not configured for Strava');
    }
    user = {
      ...user,
      strava: {
        id: user.strava?.id,
        accessToken: auth.access_token,
        expiresAt: auth.expires_at,
        refreshToken: auth.refresh_token,
      },
    };
    await userRepository.update(user);
  }

  async getStravaInfo(c2cId: number): Promise<StravaInfo | undefined> {
    const user = await userRepository.findById(c2cId);
    return user?.strava;
  }

  async configureSuunto(c2cId: number, auth: SuuntoAuth): Promise<void> {
    let user: User | undefined = await userRepository.findById(c2cId);
    if (user) {
      user = {
        ...user,
        suunto: {
          username: auth.user,
          accessToken: auth.access_token,
          expiresAt: this.#expiresAt(auth.expires_in),
          refreshToken: auth.refresh_token,
        },
      };
      await userRepository.update(user);
    } else {
      user = {
        c2cId,
        suunto: {
          username: auth.user,
          accessToken: auth.access_token,
          expiresAt: this.#expiresAt(auth.expires_in),
          refreshToken: auth.refresh_token,
        },
      };
      await userRepository.insert(user);
    }
  }

  async updateSuuntoAuth(c2cId: number, auth: SuuntoRefreshAuth): Promise<void> {
    let user: User | undefined = await userRepository.findById(c2cId);
    if (!user) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }
    if (!user.suunto || !user.suunto.username) {
      throw new NotFoundError(`User ${c2cId} not configured for Suunto`);
    }
    user = {
      ...user,
      suunto: {
        username: user.suunto?.username,
        accessToken: auth.access_token,
        expiresAt: this.#expiresAt(auth.expires_in),
        refreshToken: auth.refresh_token,
      },
    };
    await userRepository.update(user);
  }

  async getSuuntoInfo(c2cId: number): Promise<SuuntoInfo | undefined> {
    const user = await userRepository.findById(c2cId);
    return user?.suunto;
  }

  async configureGarmin(c2cId: number, auth: GarminAuth): Promise<void> {
    let user: User | undefined = await userRepository.findById(c2cId);
    if (user) {
      user = {
        ...user,
        garmin: {
          token: auth.token,
          tokenSecret: auth.tokenSecret,
        },
      };
      await userRepository.update(user);
    } else {
      user = {
        c2cId,
        garmin: {
          token: auth.token,
          tokenSecret: auth.tokenSecret,
        },
      };
      await userRepository.insert(user);
    }
  }

  async getGarminInfo(c2cId: number): Promise<GarminInfo | undefined> {
    const user = await userRepository.findById(c2cId);
    return user?.garmin;
  }

  async addActivities(c2cId: number, ...activities: Omit<Activity, 'id' | 'userId'>[]): Promise<void> {
    log.info(activities);
    const userActivities: Optional<Activity, 'id'>[] = await activityRepository.findByUser(c2cId);
    const userActivitiesKeys = new Set(userActivities.map((activity) => `${activity.vendor}_${activity.vendorId}`));
    const newActivitiesKeys = new Set(activities.map((activity) => `${activity.vendor}_${activity.vendorId}`));
    const mergedActivities: (Optional<Activity, 'id'> & { update?: boolean })[] = [
      ...userActivities.filter((activity) => !newActivitiesKeys.has(`${activity.vendor}_${activity.vendorId}`)),
      ...activities
        .map((activity) => {
          if (userActivitiesKeys.has(`${activity.vendor}_${activity.vendorId}`)) {
            // replace
            return {
              ...activity,
              id: userActivities.find(
                ({ vendor, vendorId }) => vendor === activity.vendor && vendorId === activity.vendorId,
              )?.id,
              update: true,
            };
          }
          return activity;
        })
        .map((activity) => ({ ...activity, userId: c2cId })),
    ]
      .sort(byDate)
      .reverse();
    const activitiesToUpdate = mergedActivities
      .slice(0, MAX_ACTIVITIES_PER_USER)
      .filter(isActivityToUpdate)
      .map((act) => {
        const { update, ...a } = act;
        return a;
      });

    const activitiesToInsert = mergedActivities.slice(0, MAX_ACTIVITIES_PER_USER).filter((act) => !act.id);
    const activitiesToDelete = mergedActivities.slice(MAX_ACTIVITIES_PER_USER).filter(isInDb);
    await activityRepository.upsert(activitiesToUpdate, activitiesToInsert, activitiesToDelete);
  }

  async updateActivity(c2cId: number, activity: Omit<Activity, 'id' | 'userId'>): Promise<void> {
    const savedActivity = (await activityRepository.findByUser(c2cId)).find(
      (act) => act.vendor === activity.vendor && act.vendorId === activity.vendorId,
    );
    if (savedActivity) {
      await activityRepository.update({
        ...savedActivity,
        ...{
          date: activity.date,
          name: activity.name,
        },
        ...(activity.type && { type: activity.type }),
      });
    }
  }

  async deleteActivity(vendor: Vendor, vendorId: string): Promise<void> {
    await activityRepository.deleteByVendorId(vendor, vendorId);
  }

  async getActivities(c2cId: number): Promise<Activity[]> {
    return await activityRepository.findByUser(c2cId);
  }

  async getActivity(c2cId: number, activityId: number): Promise<Activity | undefined> {
    return await activityRepository.findByUserAndId(c2cId, activityId);
  }

  #expiresAt(expiresIn: number): number {
    return Math.floor(Date.now() / 1000) + expiresIn;
  }
}

export const userService = new UserService();
