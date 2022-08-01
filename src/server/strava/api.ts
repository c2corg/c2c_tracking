import axios from 'axios';
import FormData from 'form-data';

import { handleAppError } from '../../helpers/error';

export type Athlete = {
  id: number;
};

export type StravaAuth = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  athlete: Athlete;
};

export type StravaRefreshAuth = Omit<StravaAuth, 'athlete'>;

export type ActivityType =
  | 'AlpineSki'
  | 'BackcountrySki'
  | 'Canoeing'
  | 'Crossfit'
  | 'EBikeRide'
  | 'Elliptical'
  | 'Golf'
  | 'Handcycle'
  | 'Hike'
  | 'IceSkate'
  | 'InlineSkate'
  | 'Kayaking'
  | 'Kitesurf'
  | 'NordicSki'
  | 'Ride'
  | 'RockClimbing'
  | 'RollerSki'
  | 'Rowing'
  | 'Run'
  | 'Sail'
  | 'Skateboard'
  | 'Snowboard'
  | 'Snowshoe'
  | 'Soccer'
  | 'StairStepper'
  | 'StandUpPaddling'
  | 'Surfing'
  | 'Swim'
  | 'Velomobile'
  | 'VirtualRide'
  | 'VirtualRun'
  | 'Walk'
  | 'WeightTraining'
  | 'Wheelchair'
  | 'Windsurf'
  | 'Workout'
  | 'Yoga';

export type PolylineMap = {
  polyline?: string;
  summary_polyline: string;
};

export type Activity = {
  id: number;
  name: string;
  type: ActivityType;
  start_date: string; // ISO 8601 format
  timezone: string;
  start_latlng: number[];
  map: PolylineMap;
};

type ActivityStream = {
  type: string;
  original_size: number;
  series_type: 'distance' | 'time';
  resolution: 'low' | 'medium' | 'high';
};

export type DistanceStream = ActivityStream & {
  type: 'distance';
  data: number[];
};

export type TimeStream = ActivityStream & {
  type: 'time';
  data: number[];
};

export type LatLngStream = ActivityStream & {
  type: 'latlng';
  data: number[][];
};

export type AltitudeStream = ActivityStream & {
  type: 'altitude';
  data: number[];
};

export type StreamSet = (DistanceStream | TimeStream | LatLngStream | AltitudeStream)[];

export type Subscription = {
  id: number;
  application_id: number;
  callback_url: string;
  created_at: string;
  updated_at: string;
};

export type WebhookSubscription = {
  'hub.mode': 'subscribe';
  'hub.challenge': string;
  'hub.verify_token': string;
};

export type WebhookEvent = {
  object_type: 'activity' | 'athlete';
  object_id: number;
  aspect_type: 'create' | 'update' | 'delete';
  updates?: Record<string, string>;
  owner_id: number;
  subscription_id: number;
  event_time: number;
};

export class StravaApi {
  private readonly baseUrl = 'https://www.strava.com/api/v3/';
  readonly #clientId: string;
  readonly #clientSecret: string;

  constructor() {
    this.#clientId = process.env['STRAVA_CLIENT_ID']!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    this.#clientSecret = process.env['STRAVA_CLIENT_SECRET']!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  }

  async exchangeTokens(code: string): Promise<StravaAuth> {
    try {
      const response = await axios.post<StravaAuth>(`${this.baseUrl}oauth/token`, null, {
        params: {
          client_id: this.#clientId,
          client_secret: this.#clientSecret,
          code,
          grant_type: 'authorization_code',
        },
      });
      return response.data;
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
      const response = await axios.post<StravaRefreshAuth>(`${this.baseUrl}oauth/token`, null, {
        params: {
          client_id: this.#clientId,
          client_secret: this.#clientSecret,
          refresh_token: token,
          grant_type: 'refresh_token',
        },
      });
      return response.data;
    } catch (error: unknown) {
      throw handleAppError(502, 'Error on Strava refresh token request', error);
    }
  }

  async getAthleteActivities(token: string): Promise<Activity[]> {
    try {
      const response = await axios.get<Activity[]>(`${this.baseUrl}athlete/activities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      throw handleAppError(502, 'Error on Strava getAthleteActivities request', error);
    }
  }

  async getActivity(token: string, id: string): Promise<Activity> {
    try {
      const response = await axios.get<Activity>(`${this.baseUrl}activities/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      throw handleAppError(502, 'Error on Strava getActivity request', error);
    }
  }

  async getActivityStream(token: string, id: string): Promise<StreamSet> {
    try {
      const response = await axios.get<StreamSet>(
        `${this.baseUrl}activities/${id}/streams?keys=time,latlng,altitude&key_by_type=`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return response.data;
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
      const response = await axios.post<Subscription>(`${this.baseUrl}push_subscriptions`, formData, {
        headers: formData.getHeaders(),
      });
      return response.data;
    } catch (error) {
      throw handleAppError(502, 'Error on Strava requestSubscriptionCreation request', error);
    }
  }

  async getSubscriptions(): Promise<Subscription[]> {
    try {
      const response = await axios.get<Subscription[]>(`${this.baseUrl}push_subscriptions`, {
        params: { client_id: this.#clientId, client_secret: this.#clientSecret },
      });
      return response.data;
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
