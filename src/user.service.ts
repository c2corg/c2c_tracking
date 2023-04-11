import dayjs from 'dayjs';

import config from './config.js';
import { NotFoundError } from './errors.js';
import log from './helpers/logger.js';
import type { Optional } from './helpers/utils.js';
import { miniatureService } from './miniature.service';
import type { Activity, NewActivityWithGeometry, UpdateActivity, Vendor } from './repository/activity.js';
import { activityRepository } from './repository/activity.repository';
import type { DecathlonInfo, GarminInfo, StravaInfo, SuuntoInfo, User } from './repository/user.js';
import { userRepository } from './repository/user.repository';
import type { CorosAuth } from './server/coros/coros.api';
import type { DecathlonAuth } from './server/decathlon/decathlon.api';
import type { GarminAuth } from './server/garmin/garmin.api';
import type { PolarAuth } from './server/polar/polar.api';
import type { StravaAuth, StravaRefreshAuth } from './server/strava/strava.api';
import type { SuuntoAuth, SuuntoRefreshAuth } from './server/suunto/suunto.api';

type Status = 'not-configured' | 'configured' | 'token-lost';

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

const stravaEnabled = config.get('trackers.strava.enabled');
const suuntoEnabled = config.get('trackers.suunto.enabled');
const garminEnabled = config.get('trackers.garmin.enabled');
const decathlonEnabled = config.get('trackers.decathlon.enabled');
const polarEnabled = config.get('trackers.polar.enabled');
const corosEnabled = config.get('trackers.coros.enabled');

export class UserService {
  public async getUserInfo(c2cId: number): Promise<{ [key in Vendor]?: Status }> {
    const { strava, suunto, garmin, decathlon, polar, coros } = (await userRepository.findById(c2cId)) || {};
    return {
      ...(stravaEnabled && {
        strava: strava ? (strava.refreshToken ? 'configured' : 'token-lost') : 'not-configured',
      }),
      ...(suuntoEnabled && {
        suunto: suunto ? (suunto.refreshToken ? 'configured' : 'token-lost') : 'not-configured',
      }),
      ...(garminEnabled && { garmin: garmin ? 'configured' : 'not-configured' }),
      ...(decathlonEnabled && {
        decathlon: decathlon ? (decathlon.refreshToken ? 'configured' : 'token-lost') : 'not-configured',
      }),
      ...(polarEnabled && { polar: polar ? 'configured' : 'not-configured' }),
      ...(corosEnabled && { coros: coros ? 'configured' : 'not-configured' }),
    };
  }

  public async configureStrava(c2cId: number, auth: StravaAuth): Promise<void> {
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

  public async updateStravaAuth(c2cId: number, auth: StravaRefreshAuth): Promise<void> {
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

  public async clearStravaTokens(c2cId: number): Promise<void> {
    let user: User | undefined = await userRepository.findById(c2cId);
    if (!user) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }
    if (!user.strava) {
      return;
    }
    const { accessToken, refreshToken, expiresAt, ...strava } = user.strava;
    user = { ...user, strava };
    await userRepository.update(user);
  }

  public async getStravaInfo(c2cId: number): Promise<StravaInfo | undefined> {
    const user = await userRepository.findById(c2cId);
    return user?.strava;
  }

  public async configureSuunto(c2cId: number, auth: SuuntoAuth): Promise<void> {
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

  public async updateSuuntoAuth(c2cId: number, auth: SuuntoRefreshAuth): Promise<void> {
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

  public async clearSuuntoTokens(c2cId: number): Promise<void> {
    let user: User | undefined = await userRepository.findById(c2cId);
    if (!user) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }
    if (!user.suunto) {
      return;
    }
    const { accessToken, refreshToken, expiresAt, ...suunto } = user.suunto;
    user = { ...user, suunto };
    await userRepository.update(user);
  }

  public async getSuuntoInfo(c2cId: number): Promise<SuuntoInfo | undefined> {
    const user = await userRepository.findById(c2cId);
    return user?.suunto;
  }

  public async configureGarmin(c2cId: number, auth: GarminAuth): Promise<void> {
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

  public async getGarminInfo(c2cId: number): Promise<GarminInfo | undefined> {
    const user = await userRepository.findById(c2cId);
    return user?.garmin;
  }

  public async configureDecathlon(
    c2cId: number,
    auth: DecathlonAuth,
    userId: string,
    webhookId: string,
  ): Promise<void> {
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

  public async updateDecathlonAuth(c2cId: number, auth: DecathlonAuth): Promise<void> {
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

  public async clearDecathlonTokens(c2cId: number): Promise<void> {
    let user: User | undefined = await userRepository.findById(c2cId);
    if (!user) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }
    if (!user.decathlon) {
      return;
    }
    const { accessToken, refreshToken, expiresAt, ...decathlon } = user.decathlon;
    user = { ...user, decathlon };
    await userRepository.update(user);
  }

  public async getDecathlonInfo(c2cId: number): Promise<DecathlonInfo | undefined> {
    const user = await userRepository.findById(c2cId);
    return user?.decathlon;
  }

  public async configurePolar(c2cId: number, auth: PolarAuth): Promise<void> {
    let user: User | undefined = await userRepository.findById(c2cId);
    if (user) {
      user = {
        ...user,
        polar: {
          id: auth.x_user_id,
          token: auth.access_token,
        },
      };
      await userRepository.update(user);
    } else {
      user = {
        c2cId,
        polar: {
          id: auth.x_user_id,
          token: auth.access_token,
        },
      };
      await userRepository.insert(user);
    }
  }

  public async configureCoros(c2cId: number, auth: CorosAuth): Promise<void> {
    let user: User | undefined = await userRepository.findById(c2cId);
    if (user) {
      user = {
        ...user,
        coros: {
          id: auth.openId,
          accessToken: auth.access_token,
          expiresAt: dayjs().add(this.corosTokenDurationDays, 'day').unix(),
          refreshToken: auth.refresh_token,
        },
      };
      await userRepository.update(user);
    } else {
      user = {
        c2cId,
        coros: {
          id: auth.openId,
          accessToken: auth.access_token,
          expiresAt: dayjs().add(this.corosTokenDurationDays, 'day').unix(),
          refreshToken: auth.refresh_token,
        },
      };
      await userRepository.insert(user);
    }
  }

  public async resetCorosAuthExpiration(c2cId: number): Promise<void> {
    let user: User | undefined = await userRepository.findById(c2cId);
    if (!user) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }
    if (!user.coros || !user.coros.id) {
      throw new NotFoundError(`User ${c2cId} not configured for Coros`);
    }
    user = {
      ...user,
      coros: { ...user.coros, expiresAt: dayjs().add(this.corosTokenDurationDays, 'day').unix() },
    };
    await userRepository.update(user);
  }

  public async clearCorosTokens(c2cId: number): Promise<void> {
    let user: User | undefined = await userRepository.findById(c2cId);
    if (!user) {
      throw new NotFoundError(`User ${c2cId} not found`);
    }
    if (!user.coros) {
      return;
    }
    const { accessToken, refreshToken, expiresAt, ...coros } = user.coros;
    user = { ...user, coros };
    await userRepository.update(user);
  }

  private corosTokenDurationDays = 29; // 30, but let's have a lower limit because we aren't sur of the exact time

  public async addActivities(c2cId: number, ...newActivities: NewActivityWithGeometry[]): Promise<void> {
    if (!newActivities.length) {
      return;
    }
    const userActivities: Optional<Activity, 'id'>[] = await activityRepository.findByUser(c2cId);
    const userActivitiesKeys = new Set(userActivities.map((activity) => `${activity.vendor}_${activity.vendorId}`));
    const newActivitiesKeys = new Set(newActivities.map((activity) => `${activity.vendor}_${activity.vendorId}`));
    const mergedActivities: (Optional<Activity, 'id'> & { update?: boolean })[] = [
      ...userActivities.filter((activity) => !newActivitiesKeys.has(`${activity.vendor}_${activity.vendorId}`)),
      ...newActivities
        .map((activity) => {
          if (userActivitiesKeys.has(`${activity.vendor}_${activity.vendorId}`)) {
            // replace
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const userActivity = userActivities.find(
              ({ vendor, vendorId }) => vendor === activity.vendor && vendorId === activity.vendorId,
            )!;

            return {
              ...userActivity,
              ...activity,
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

    await Promise.allSettled(
      activitiesToDelete.map(async (act) => {
        if (act.miniature) {
          await miniatureService.deleteMiniature(act.miniature);
        }
      }),
    );
    await Promise.allSettled(
      [...activitiesToUpdate, ...activitiesToInsert].map(async (act) => {
        if (!act.geojson) {
          return;
        }
        const miniature = await miniatureService.generateMiniature(act.geojson);
        act.miniature = miniature;
      }),
    );
    await activityRepository.upsert(activitiesToUpdate, activitiesToInsert, activitiesToDelete);
  }

  public async updateActivity(c2cId: number, activity: UpdateActivity): Promise<void> {
    const savedActivity = (await activityRepository.findByUser(c2cId)).find(
      (act) => act.vendor === activity.vendor && act.vendorId === activity.vendorId,
    );
    if (!savedActivity) {
      return;
    }
    await activityRepository.update({
      ...savedActivity,
      ...(activity.date && { date: activity.date }),
      ...(activity.type && { type: activity.type }),
      ...(activity.name && { name: activity.name }),
      ...(activity.length && { length: activity.length }),
      ...(activity.heightDiffUp && { heightDiffUp: activity.heightDiffUp }),
      ...(activity.duration && { duration: activity.duration }),
      ...(activity.geojson && { geojson: activity.geojson }),
    });
  }

  public async deleteActivity(vendor: Vendor, vendorId: string): Promise<void> {
    let miniature: string | undefined;
    try {
      miniature = await activityRepository.getMiniatureByVendorId(vendor, vendorId);
    } catch (error: unknown) {
      log.warn(`Failed retrieving miniature info for ${vendorId}`);
    }
    await activityRepository.deleteByVendorId(vendor, vendorId);
    if (miniature) {
      try {
        await miniatureService.deleteMiniature(miniature);
      } catch (error: unknown) {
        log.warn(`Failed deleting miniature ${miniature}`);
      }
    }
  }

  public async getActivities(c2cId: number): Promise<Activity[]> {
    return await activityRepository.findByUser(c2cId);
  }

  public async getActivity(c2cId: number, activityId: number): Promise<Activity | undefined> {
    return await activityRepository.findByUserAndId(c2cId, activityId);
  }

  #expiresAt(expiresIn: number): number {
    return Math.floor(Date.now() / 1000) + expiresIn;
  }
}

export const userService = new UserService();
