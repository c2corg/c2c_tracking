import axios from 'axios';
import isISO8601 from 'validator/lib/isISO8601';
import { z } from 'zod';

import config from '../../config';
import { handleExternalApiError } from '../../helpers/error';

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

export const SportType = z.enum([
  'AlpineSki',
  'BackcountrySki',
  'Canoeing',
  'Crossfit',
  'EBikeRide',
  'Elliptical',
  'EMountainBikeRide',
  'Golf',
  'GravelRide',
  'Handcycle',
  'Hike',
  'IceSkate',
  'InlineSkate',
  'Kayaking',
  'Kitesurf',
  'MountainBikeRide',
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
  'TrailRun',
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
export type SportType = z.infer<typeof SportType>;

export const PolylineMap = z.object({
  polyline: z.string().min(1).optional(),
  summary_polyline: z.string().min(1),
});
export type PolylineMap = z.infer<typeof PolylineMap>;

export const Activity = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  sport_type: SportType,
  start_date: z.string().refine(isISO8601),
  distance: z.number().nonnegative(), // in meters
  elapsed_time: z.number().int().nonnegative(), // in seconds
  total_elevation_gain: z.number().nonnegative(), // in meters
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
  updates: z.record(z.string()).optional(),
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

  public async exchangeToken(code: string): Promise<StravaAuth> {
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
      throw handleExternalApiError('strava', 'Error on Strava token exchange request', error);
    }
  }

  public async deauthorize(accessToken: string): Promise<void> {
    try {
      await axios.post<void>(`${this.baseUrl}oauth/deauthorize?access_token=${accessToken}`);
    } catch (error: unknown) {
      throw handleExternalApiError('strava', 'Error on Strava deauthorize request', error);
    }
  }

  public async refreshAuth(refreshToken: string): Promise<StravaRefreshAuth> {
    try {
      const response = await axios.post(`${this.baseUrl}oauth/token`, null, {
        params: {
          client_id: this.#clientId,
          client_secret: this.#clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        },
      });
      return StravaRefreshAuth.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('strava', 'Error on Strava refresh token request', error);
    }
  }

  public async getAthleteActivities(accessToken: string): Promise<Activity[]> {
    try {
      const response = await axios.get(`${this.baseUrl}athlete/activities`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return z.array(Activity).parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('strava', 'Error on Strava getAthleteActivities request', error);
    }
  }

  public async getActivity(accessToken: string, id: string): Promise<Activity> {
    try {
      const response = await axios.get(`${this.baseUrl}activities/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return Activity.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('strava', 'Error on Strava getActivity request', error);
    }
  }

  public async getActivityStream(accessToken: string, id: string): Promise<StreamSet> {
    try {
      const response = await axios.get(
        `${this.baseUrl}activities/${id}/streams?keys=time,latlng,altitude&key_by_type=true`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      return StreamSet.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('strava', 'Error on Strava getActivityStream request', error);
    }
  }

  public async requestSubscriptionCreation(callbackUrl: string, verifyToken: string): Promise<Subscription> {
    try {
      const response = await axios.post(
        `${this.baseUrl}push_subscriptions`,
        {
          client_id: this.#clientId,
          client_secret: this.#clientSecret,
          callback_url: callbackUrl,
          verify_token: verifyToken,
        },
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      );
      return Subscription.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('strava', 'Error on Strava requestSubscriptionCreation request', error);
    }
  }

  public async getSubscriptions(): Promise<Subscription[]> {
    try {
      const response = await axios.get(`${this.baseUrl}push_subscriptions`, {
        params: { client_id: this.#clientId, client_secret: this.#clientSecret },
      });
      return z.array(Subscription).parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('strava', 'Error on Strava getSubscriptions request', error);
    }
  }

  public async deleteSubscription(id: string): Promise<void> {
    try {
      await axios.delete<void>(`${this.baseUrl}push_subscriptions/${id}`, {
        params: { client_id: this.#clientId, client_secret: this.#clientSecret },
      });
    } catch (error: unknown) {
      throw handleExternalApiError('strava', 'Error on Strava deleteSubscription request', error);
    }
  }
}

export const stravaApi = new StravaApi();
