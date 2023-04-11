import axios from 'axios';
import validator from 'validator';
import { z } from 'zod';

import config from '../../config.js';
import { handleExternalApiError } from '../../helpers/error.js';

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

const sportTypes = [
  'AlpineSki',
  'BackcountrySki',
  'Badminton',
  'Canoeing',
  'Crossfit',
  'EBikeRide',
  'Elliptical',
  'EMountainBikeRide',
  'Golf',
  'GravelRide',
  'Handcycle',
  'HighIntensityIntervalTraining',
  'Hike',
  'IceSkate',
  'InlineSkate',
  'Kayaking',
  'Kitesurf',
  'MountainBikeRide',
  'NordicSki',
  'Pickleball',
  'Pilates',
  'Racquetball',
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
  'Squash',
  'StairStepper',
  'StandUpPaddling',
  'Surfing',
  'Swim',
  'TableTennis',
  'Tennis',
  'TrailRun',
  'Velomobile',
  'VirtualRide',
  'VirtualRow',
  'VirtualRun',
  'Walk',
  'WeightTraining',
  'Wheelchair',
  'Windsurf',
  'Workout',
  'Yoga',
];
export const SportType = z.preprocess((val) => {
  const s = String(val);
  if (sportTypes.includes(s)) {
    return s;
  }
  return 'Unknown';
}, z.string());
export type SportType = z.infer<typeof SportType>;

export const Activity = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  sport_type: SportType,
  start_date: z.string().refine(validator.isISO8601, {
    message: 'String must be an ISO-8601 date',
  }),
  start_date_local: z.string().refine(validator.isISO8601, {
    message: 'String must be an ISO-8601 date',
  }),
  distance: z.number().nonnegative(), // in meters
  elapsed_time: z.number().int().nonnegative(), // in seconds
  total_elevation_gain: z.number().nonnegative(), // in meters
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
  created_at: z.string().refine(validator.isISO8601, {
    message: 'String must be an ISO-8601 date',
  }),
  updated_at: z.string().refine(validator.isISO8601, {
    message: 'String must be an ISO-8601 date',
  }),
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

  public async getActivity(accessToken: string, id: number): Promise<Activity> {
    try {
      const response = await axios.get(`${this.baseUrl}activities/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return Activity.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('strava', 'Error on Strava getActivity request', error);
    }
  }

  public async getActivityStream(accessToken: string, id: number): Promise<StreamSet> {
    try {
      const response = await axios.get(
        `${this.baseUrl}activities/${id}/streams?keys=time,latlng,altitude&key_by_type=`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      return StreamSet.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('strava', 'Error on Strava getActivityStream request', error);
    }
  }

  public async requestSubscriptionCreation(callbackUrl: string, verifyToken: string): Promise<number> {
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
      return z.object({ id: z.number().int().positive() }).parse(response.data).id;
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
