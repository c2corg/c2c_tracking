import { toGeoJSON } from '@mapbox/polyline';
import dayjs from 'dayjs';
import pino from 'pino';

import { Activity } from '../../repository/activity';
import { stravaRepository } from '../../repository/strava.repository';
import { userService } from '../../user.service';

import { Activity as StravaActivity, StravaAuth, stravaApi as api, stravaApi, WebhookEvent } from './api';

const log = pino();

const webhookCallbackUrl = `${process.env.SERVER_BASE_URL}/strava/webhook`;
export class StravaService {
  readonly subscriptionErrorUrl;
  readonly subscriptionSuccessUrl;
  readonly stravaWebhookSubscriptionVerifyToken;

  constructor() {
    [
      'SERVER_BASE_URL',
      'FRONTEND_BASE_URL',
      'SUBSCRIPTION_ERROR_URL',
      'SUBSCRIPTION_SUCCESS_URL',
      'STRAVA_WEBHOOK_SUBSCRIPTION_VERIFY_TOKEN',
    ].forEach((envvar) => {
      if (!process.env[envvar]) {
        throw new Error(`Missing configuration variable: ${envvar}`);
      }
    });
    this.subscriptionErrorUrl = `${process.env.FRONTEND_BASE_URL}/${process.env.SUBSCRIPTION_ERROR_URL}`;
    this.subscriptionSuccessUrl = `${process.env.FRONTEND_BASE_URL}/${process.env.SUBSCRIPTION_SUCCESS_URL}`;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.stravaWebhookSubscriptionVerifyToken = process.env.STRAVA_WEBHOOK_SUBSCRIPTION_VERIFY_TOKEN!;
    this.setupWebhook();
  }

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
      log.error(err);
    }
  }

  async getToken(c2cId: number): Promise<string | undefined> {
    // regenerate auth tokens as needed if expired
    const stravaInfo = await userService.getStravaInfo(c2cId);
    if (stravaInfo?.access_token && dayjs(stravaInfo.expires_at).isAfter(dayjs().subtract(1, 'minute'))) {
      return stravaInfo.access_token;
    }
    if (stravaInfo?.refresh_token) {
      const auth = await api.refreshAuth(stravaInfo.refresh_token);
      await userService.updateStravaAuth(c2cId, auth);
      return stravaInfo.access_token;
    }
  }

  async getActivityLine(token: string, id: string): Promise<GeoJSON.LineString> {
    const { map } = await stravaApi.getActivity(token, id);
    return toGeoJSON(map.polyline || map.summary_polyline);
  }

  async setupWebhook(): Promise<void> {
    (await this.checkWebhookSubscription()) || this.requestWebhookSubscription();
  }

  private async checkWebhookSubscription(): Promise<boolean> {
    const subscriptionId = await stravaRepository.findSubscription();
    if (!subscriptionId) {
      return false;
    }
    try {
      const subscriptions = await stravaApi.getSubscriptions();
      return subscriptions.some(
        (subscription) => subscription.id === subscriptionId && subscription.callback_url === webhookCallbackUrl,
      );
    } catch (error) {
      // TODO log / report?
      return false; // subscription could not be checked, assume it is not set
    }
  }

  private async requestWebhookSubscription(): Promise<void> {
    const subscription = await stravaApi.requestSubscriptionCreation(
      webhookCallbackUrl,
      this.stravaWebhookSubscriptionVerifyToken,
    );
    stravaRepository.setSubscription(subscription.id); // async call
  }

  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    switch (event.object_type) {
      case 'athlete':
        if (event.aspect_type == 'delete') {
          // TODO clear user data
        }
        break;
      case 'activity':
        switch (event.aspect_type) {
          case 'create':
            // TODO retrieve activity, add
            break;
          case 'update':
            // TODO update of title / type / private
            break;
          case 'delete':
            // TODO
            break;
        }
        break;
    }
  }
}

export const stravaService = new StravaService();
