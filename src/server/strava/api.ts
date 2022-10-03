import axios from 'axios';
import FormData from 'form-data';
import isISO8601 from 'validator/lib/isISO8601';
import { z } from 'zod';

import config from '../../config';
import { handleAppError } from '../../helpers/error';

export const Athlete = z.object({
  id: z.number().int().positive(),
});
export type Athlete = z.infer<typeof Athlete>;

export const StravaAuth = z.object({
  access_token: z.string().min(10).max(5000),
  refresh_token: z.string().min(10).max(5000),
  expires_at: z.number().int().positive(),
  expires_in: z.number().int().positive(),
  athlete: Athlete,
});
export type StravaAuth = z.infer<typeof StravaAuth>;

export const StravaRefreshAuth = StravaAuth.omit({ athlete: true });
export type StravaRefreshAuth = z.infer<typeof StravaRefreshAuth>;

export const ActivityType = z.enum([
  'AlpineSki',
  'BackcountrySki',
  'Canoeing',
  'Crossfit',
  'EBikeRide',
  'Elliptical',
  'Golf',
  'Handcycle',
  'Hike',
  'IceSkate',
  'InlineSkate',
  'Kayaking',
  'Kitesurf',
  'NordicSki',
  'Ride',
  'RockClimbing',
  'RollerSki',
  'Rowing',
  'Run',
  'Sail',
  'Skateboard',
  'Snowboard',
  'Snowshoe',
  'Soccer',
  'StairStepper',
  'StandUpPaddling',
  'Surfing',
  'Swim',
  'Velomobile',
  'VirtualRide',
  'VirtualRun',
  'Walk',
  'WeightTraining',
  'Wheelchair',
  'Windsurf',
  'Workout',
  'Yoga',
]);
export type ActivityType = z.infer<typeof ActivityType>;

export const PolylineMap = z.object({
  polyline: z.string().min(1).optional(),
  summary_polyline: z.string().min(1),
});
export type PolylineMap = z.infer<typeof PolylineMap>;

export const Activity = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  type: ActivityType,
  start_date: z.string().refine(isISO8601),
  timezone: z.string().min(1).max(50),
  start_latlng: z.array(z.number()),
  map: PolylineMap,
});
export type Activity = z.infer<typeof Activity>;

const ActivityStream = z.object({
  type: z.string(),
  original_size: z.number().int().positive(),
  series_type: z.enum(['distance', 'time']),
  resolution: z.enum(['low', 'medium', 'high']),
});
type ActivityStream = z.infer<typeof ActivityStream>;

export const DistanceStream = ActivityStream.extend({
  type: z.literal('distance'),
  data: z.array(z.number()),
});
export type DistanceStream = z.infer<typeof DistanceStream>;

export const TimeStream = ActivityStream.extend({
  type: z.literal('time'),
  data: z.array(z.number().int()),
});
export type TimeStream = z.infer<typeof TimeStream>;

export const LatLngStream = ActivityStream.extend({
  type: z.literal('latlng'),
  data: z.array(z.array(z.number())),
});
export type LatLngStream = z.infer<typeof LatLngStream>;

export const AltitudeStream = ActivityStream.extend({
  type: z.literal('altitude'),
  data: z.array(z.number()),
});
export type AltitudeStream = z.infer<typeof AltitudeStream>;

export const StreamSet = z.array(DistanceStream.or(TimeStream).or(LatLngStream).or(AltitudeStream));
export type StreamSet = z.infer<typeof StreamSet>;

export const Subscription = z.object({
  id: z.number().int().positive(),
  application_id: z.number().int().positive(),
  callback_url: z.string().url(),
  created_at: z.string().refine(isISO8601),
  updated_at: z.string().refine(isISO8601),
});
export type Subscription = z.infer<typeof Subscription>;

export const WebhookSubscription = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.challenge': z.string().min(1).max(255),
  'hub.verify_token': z.string().min(1).max(255),
});
export type WebhookSubscription = z.infer<typeof WebhookSubscription>;

export const WebhookEvent = z.object({
  object_type: z.enum(['activity', 'athlete']),
  object_id: z.number().int().positive(),
  aspect_type: z.enum(['create', 'update', 'delete']),
  updates: z.record(z.string()),
  owner_id: z.number().int().positive(),
  subscription_id: z.number().int().positive(),
  event_time: z.number().int().positive(),
});
export type WebhookEvent = z.infer<typeof WebhookEvent>;

export class StravaApi {
  private readonly baseUrl = 'https://www.strava.com/api/v3/';
  readonly #clientId: string;
  readonly #clientSecret: string;

  constructor() {
    this.#clientId = config.get('trackers.strava.clientId');
    this.#clientSecret = config.get('trackers.strava.clientSecret');
  }

  async exchangeToken(code: string): Promise<StravaAuth> {
    try {
      const response = await axios.post(`${this.baseUrl}oauth/token`, null, {
        params: {
          client_id: this.#clientId,
          client_secret: this.#clientSecret,
          code,
          grant_type: 'authorization_code',
        },
      });
      return StravaAuth.parse(response.data);
    } catch (error: unknown) {
      throw handleAppError(502, 'Error on Strava token exchange request', error);
    }
  }

  async deauthorize(token: string): Promise<void> {
    try {
      await axios.post<void>(`${this.baseUrl}oauth/deauthorize?access_token=${token}`);
    } catch (error) {
      throw handleAppError(502, 'Error on Strava deauthorize request', error);
    }
  }

  async refreshAuth(token: string): Promise<StravaRefreshAuth> {
    try {
      const response = await axios.post(`${this.baseUrl}oauth/token`, null, {
        params: {
          client_id: this.#clientId,
          client_secret: this.#clientSecret,
          refresh_token: token,
          grant_type: 'refresh_token',
        },
      });
      return StravaRefreshAuth.parse(response.data);
    } catch (error: unknown) {
      throw handleAppError(502, 'Error on Strava refresh token request', error);
    }
  }

  async getAthleteActivities(token: string): Promise<Activity[]> {
    try {
      const response = await axios.get(`${this.baseUrl}athlete/activities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return z.array(Activity).parse(response.data);
    } catch (error) {
      throw handleAppError(502, 'Error on Strava getAthleteActivities request', error);
    }
  }

  async getActivity(token: string, id: string): Promise<Activity> {
    try {
      const response = await axios.get(`${this.baseUrl}activities/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return Activity.parse(response.data);
    } catch (error) {
      throw handleAppError(502, 'Error on Strava getActivity request', error);
    }
  }

  async getActivityStream(token: string, id: string): Promise<StreamSet> {
    try {
      const response = await axios.get(
        `${this.baseUrl}activities/${id}/streams?keys=time,latlng,altitude&key_by_type=`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return StreamSet.parse(response.data);
    } catch (error) {
      throw handleAppError(502, 'Error on Strava getActivityStream request', error);
    }
  }

  async requestSubscriptionCreation(callbackUrl: string, verifyToken: string): Promise<Subscription> {
    try {
      const formData = new FormData();
      formData.append('client_id', this.#clientId);
      formData.append('client_secret', this.#clientSecret);
      formData.append('callback_url', callbackUrl);
      formData.append('verify_token', verifyToken);
      const response = await axios.post(`${this.baseUrl}push_subscriptions`, formData, {
        headers: formData.getHeaders(),
      });
      return Subscription.parse(response.data);
    } catch (error) {
      throw handleAppError(502, 'Error on Strava requestSubscriptionCreation request', error);
    }
  }

  async getSubscriptions(): Promise<Subscription[]> {
    try {
      const response = await axios.get(`${this.baseUrl}push_subscriptions`, {
        params: { client_id: this.#clientId, client_secret: this.#clientSecret },
      });
      return z.array(Subscription).parse(response.data);
    } catch (error) {
      throw handleAppError(502, 'Error on Strava getSubscriptions request', error);
    }
  }

  async deleteSubscription(id: string): Promise<void> {
    try {
      await axios.delete<void>(`${this.baseUrl}push_subscriptions/${id}`, {
        params: { client_id: this.#clientId, client_secret: this.#clientSecret },
      });
    } catch (error) {
      throw handleAppError(502, 'Error on Strava deleteSubscription request', error);
    }
  }
}

export const stravaApi = new StravaApi();
