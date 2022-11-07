import axios from 'axios';
import isISO8601 from 'validator/lib/isISO8601';
import { z } from 'zod';

import config from '../../config';
import { handleExternalApiError } from '../../helpers/error';

export const DecathlonAuth = z.object({
  access_token: z.string().min(10).max(5000),
  token_type: z.literal('bearer'),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(10).max(5000),
  jti: z.string().min(5).max(100).optional(),
});
export type DecathlonAuth = z.infer<typeof DecathlonAuth>;

// note: couldn't manage to use ActivitySummary.extend and make locations an optional property...
// as locations is still optional in full activity (and absent in summary), let's use a single Activity entity
export const Activity = z.object({
  id: z.string().min(5).max(100),
  name: z.string().max(100).optional(),
  sport: z.string().regex(/^\/v2\/sports\/\d+$/),
  startdate: z.string().refine(isISO8601),
  duration: z.number().nonnegative().optional(),
  elevation: z.number().nonnegative().optional(),
  dataSummaries: z.record(z.string(), z.number()),
  locations: z
    .record(
      z.string(),
      z.object({
        latitude: z.number(),
        longitude: z.number(),
        elevation: z.number(),
      }),
    )
    .optional(),
});
export type Activity = z.infer<typeof Activity>;
const ActivitySummary = Activity;
type ActivitySummary = z.infer<typeof Activity>;

export const WebhookSubscription = z.object({
  id: z.string(),
  user: z.string(),
  url: z.string().url(),
  events: z.array(z.enum(['activity_create', 'activity_delete'])),
});
export type WebhookSubscription = z.infer<typeof WebhookSubscription>;

export const WebhookEvent = z.object({
  userId: z.string().min(1),
  event: z.object({
    name: z.enum(['activity_create', 'activity_delete']),
    ressource_id: z.string(),
    event_time: z.number().int().positive(),
  }),
});
export type WebhookEvent = z.infer<typeof WebhookEvent>;

export class DecathlonApi {
  private readonly baseUrl = 'https://api-global.decathlon.net/';
  private readonly redirectUrl: string;
  readonly #clientId: string;
  readonly #clientSecret: string;
  readonly #apiKey: string;

  constructor() {
    this.#clientId = config.get('trackers.decathlon.clientId');
    this.#clientSecret = config.get('trackers.decathlon.clientSecret');
    this.#apiKey = config.get('trackers.decathlon.apiKey');
    this.redirectUrl =
      config.get('c2c.frontend.baseUrl') + config.get('c2c.frontend.subscriptionPath') + '/decathlon/exchange-token';
  }

  public async exchangeToken(code: string): Promise<DecathlonAuth> {
    try {
      const response = await axios.post(`${this.baseUrl}connect/oauth/token`, null, {
        params: {
          client_id: this.#clientId,
          client_secret: this.#clientSecret,
          code,
          redirect_uri: this.redirectUrl,
          grant_type: 'authorization_code',
        },
      });
      return DecathlonAuth.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('decathlon', 'Error on Decathlon token exchange request', error);
    }
  }

  public async refreshAuth(refreshToken: string): Promise<DecathlonAuth> {
    try {
      const response = await axios.postForm(
        `${this.baseUrl}connect/oauth/token`,
        {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Basic ' + Buffer.from(`${this.#clientId}:${this.#clientSecret}`).toString('base64'),
          },
        },
      );
      return DecathlonAuth.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('decathlon', 'Error on Decathlon refresh token request', error);
    }
  }

  public async getUserId(accessToken: string): Promise<string> {
    try {
      const response = await axios.get(`${this.baseUrl}sportstrackingdata/v2/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-api-key': this.#apiKey,
          Accept: 'application/json',
        },
      });
      return z
        .object({
          id: z.string().min(1).max(100),
        })
        .parse(response.data).id;
    } catch (error: unknown) {
      throw handleExternalApiError('decathlon', 'Error on Decathlon getUserInfo request', error);
    }
  }

  // first page retrieved will contain at most 30 activities
  public async getActivities(accessToken: string): Promise<ActivitySummary[]> {
    try {
      const response = await axios.get(`${this.baseUrl}sportstrackingdata/v2/activities`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-api-key': this.#apiKey,
          Accept: 'application/json',
        },
      });
      return z.array(ActivitySummary).parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('decathlon', 'Error on Decathlon getActivities request', error);
    }
  }

  public async getActivity(accessToken: string, activityId: string): Promise<Activity> {
    try {
      const response = await axios.get(`${this.baseUrl}sportstrackingdata/v2/activities/${activityId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-api-key': this.#apiKey,
          Accept: 'application/json',
        },
      });
      return Activity.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('decathlon', 'Error on Decathlon getActivity request', error);
    }
  }

  public async getExistingWebhookSubscription(accessToken: string): Promise<string | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}sportstrackingdata/v2/user_web_hooks`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-api-key': this.#apiKey,
          Accept: 'application/json',
        },
      });
      return z
        .array(WebhookSubscription)
        .parse(response.data)
        .find((webhook) => webhook.url === config.get('server.baseUrl') + 'decathlon/webhook')?.id;
    } catch (error: unknown) {
      throw handleExternalApiError('decathlon', 'Error on Decathlon getExistingWebhookSubscription request', error);
    }
  }

  public async createWebhookSubscription(userId: string, accessToken: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}sportstrackingdata/v2/user_web_hooks`,
        {
          user: `/v2/users/${userId}`,
          url: config.get('server.baseUrl') + 'decathlon/webhook',
          events: ['activity_create', 'activity_delete'],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'x-api-key': this.#apiKey,
            Accept: 'application/json',
          },
        },
      );
      return WebhookSubscription.parse(response.data).id;
    } catch (error: unknown) {
      throw handleExternalApiError('decathlon', 'Error on Decathlon createWebhookSubscription request', error);
    }
  }

  public async deleteWebhookSubscription(id: string, accessToken: string): Promise<void> {
    try {
      await axios.delete(`${this.baseUrl}sportstrackingdata/v2/user_web_hooks/${id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-api-key': this.#apiKey,
        },
      });
    } catch (error: unknown) {
      throw handleExternalApiError('decathlon', 'Error on Decathlon deleteWebhookSubscription request', error);
    }
  }
}

export const decathlonApi = new DecathlonApi();
