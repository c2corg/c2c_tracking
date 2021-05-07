import pino from 'pino';

import { Activity } from '../../repository/activity';
import { userService } from '../../user.service';

import { Activity as StravaActivity, StravaAuth, stravaApi as api } from './api';

const log = pino();

export class StravaService {
  readonly subscriptionErrorUrl = 'http://localhost:8080/error'; //! FIXME
  readonly subscriptionSuccessUrl = 'http://localhost:8080'; //! FIXME

  containsRequiredScopes(scopes: string[]): boolean {
    return scopes.some((scope) => ['activity:read', 'activity:read_all'].includes(scope));
  }

  async requestShortLivedAccessTokenAndSetupUser(c2cId: number, authorizationCode: string): Promise<void> {
    const token = await api.exchangeTokens(authorizationCode);
    this.setupUser(c2cId, token); // do this asynchronously
  }

  async setupUser(c2cId: number, auth: StravaAuth): Promise<void> {
    try {
      // TODO check user exists, check rights?
      // retrieve last 30 outings
      const activities: StravaActivity[] = await api.getAthleteActivities(auth.access_token);
      await userService.configureStrava(c2cId, auth);
      await userService.addActivities(
        c2cId,
        ...activities.map(
          (activity) =>
            ({
              vendor: 'strava',
              vendorId: activity.id,
              date: activity.start_date_local,
              name: activity.name,
              type: activity.type,
            } as Activity),
        ),
      );
    } catch (err) {
      // TODO
      log.error(err);
    }
  }
}

export const stravaService = new StravaService();
