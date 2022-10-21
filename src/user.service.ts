import dayjs from 'dayjs';

import { NotFoundError } from './errors';
import log from './helpers/logger';
import type { Optional } from './helpers/utils';
import type { Activity, Vendor } from './repository/activity';
import { activityRepository } from './repository/activity.repository';
import type { DecathlonInfo, GarminInfo, StravaInfo, SuuntoInfo, User } from './repository/user';
import { userRepository } from './repository/user.repository';
import type { DecathlonAuth } from './server/decathlon/decathlon.api';
import type { GarminAuth } from './server/garmin/garmin.api';
import type { StravaAuth, StravaRefreshAuth } from './server/strava/strava.api';
import type { SuuntoAuth, SuuntoRefreshAuth } from './server/suunto/suunto.api';

const MAX_ACTIVITIES_PER_USER = 30;

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
  async getUserInfo(c2cId: number): Promise<{ [key in Vendor]: boolean }> {
    const { strava, suunto, garmin, decathlon } = (await userRepository.findById(c2cId)) || {};
    return {
      strava: !!strava,
      suunto: !!suunto,
      garmin: !!garmin,
      decathlon: !!decathlon,
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
      throw new NotFoundError(`User ${c2cId} not found`);
    }
    if (!user.strava || !user.strava.id) {
      throw new NotFoundError(`User ${c2cId} not configured for Strava`);
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

  async configureDecathlon(c2cId: number, auth: DecathlonAuth, userId: string, webhookId: string): Promise<void> {
    let user: User | undefined = await userRepository.findById(c2cId);
    if (user) {
      user = {
        ...user,
        decathlon: {
          id: userId,
          accessToken: auth.access_token,
          expiresAt: this.#expiresAt(auth.expires_in),
          refreshToken: auth.refresh_token,
          webhookId: webhookId,
        },
      };
      await userRepository.update(user);
    } else {
      user = {
        c2cId,
        decathlon: {
          id: userId,
          accessToken: auth.access_token,
          expiresAt: this.#expiresAt(auth.expires_in),
          refreshToken: auth.refresh_token,
          webhookId: webhookId,
        },
      };
      await userRepository.insert(user);
    }
  }

  async updateDecathlonAuth(c2cId: number, auth: DecathlonAuth): Promise<void> {
    let user: User | undefined = await userRepository.findById(c2cId);
    if (!user) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }
    if (!user.decathlon || !user.decathlon.id) {
      throw new NotFoundError(`User ${c2cId} not configured for Decathlon`);
    }
    user = {
      ...user,
      decathlon: {
        id: user.decathlon.id,
        accessToken: auth.access_token,
        expiresAt: this.#expiresAt(auth.expires_in),
        refreshToken: auth.refresh_token,
        webhookId: user.decathlon.webhookId,
      },
    };
    await userRepository.update(user);
  }

  async getDecathlonInfo(c2cId: number): Promise<DecathlonInfo | undefined> {
    const user = await userRepository.findById(c2cId);
    return user?.decathlon;
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
              id: userActivities.find(
                ({ vendor, vendorId }) => vendor === activity.vendor && vendorId === activity.vendorId,
              )?.id,
              update: true,
              ...activity,
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
    if (!savedActivity) {
      return;
    }
    await activityRepository.update({
      ...savedActivity,
      date: activity.date,
      type: activity.type,
      ...(activity.name && { name: activity.name }),
    });
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
