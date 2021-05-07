import { Activity } from './repository/activity';
import { activityRepository } from './repository/activity.repository';
import { User } from './repository/user';
import { userRepository } from './repository/user.repository';
import { StravaAuth } from './server/strava/api';

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

const MAX_ACTIVITIES_PER_USER = 30;

//! FIXME correctly handle dates
const byDate = (a1: Optional<Activity, 'id'>, a2: Optional<Activity, 'id'>): number => a1.date.localeCompare(a2.date);

const isInDb = (activity: Optional<Activity, 'id'>): activity is Activity => !!activity.id;

export class UserService {
  async configureStrava(c2cId: number, auth: StravaAuth): Promise<void> {
    let user: User | undefined = await userRepository.findById(c2cId);
    if (user) {
      user = {
        ...user,
        strava: {
          id: auth.athlete.id,
          access_token: auth.access_token,
          expires_at: auth.expires_at,
          refresh_token: auth.refresh_token,
        },
      };
      await userRepository.update(user);
    } else {
      user = {
        c2cId,
        strava: {
          id: auth.athlete.id,
          access_token: auth.access_token,
          expires_at: auth.expires_at,
          refresh_token: auth.refresh_token,
        },
      };
      await userRepository.insert(user);
    }
  }

  async addActivities(c2cId: number, ...activities: Omit<Activity, 'id' | 'userId'>[]): Promise<void> {
    let userActivities: Optional<Activity, 'id'>[] = await activityRepository.findByUser(c2cId);
    const userActivitiesKeys = new Set(userActivities.map((activity) => `${activity.vendor}_${activity.vendorId}`));
    userActivities = [
      ...userActivities,
      ...activities
        // ensure this is not a duplicate
        .filter((activity) => !userActivitiesKeys.has(`${activity.vendor}_${activity.vendorId}`))
        .map((activity) => ({ ...activity, userId: c2cId })),
    ].sort(byDate);
    // TODO: transaction? "upsert" in repository with transaction
    // insert the ones needed to
    const activitiesToAdd = userActivities.slice(0, MAX_ACTIVITIES_PER_USER).filter((a) => !isInDb(a));
    for (const a of activitiesToAdd) {
      await activityRepository.insert(a);
    }
    // remove oldest ones
    const activitiesToDelete = userActivities.slice(MAX_ACTIVITIES_PER_USER).filter(isInDb);
    for (const { id } of activitiesToDelete) {
      await activityRepository.delete(id);
    }
  }
}

export const userService = new UserService();
