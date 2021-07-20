import axios, { AxiosResponse } from 'axios';
import FormData from 'form-data';

import { AppError } from '../../errors';

export interface Athlete {
  id: number;
}
export interface StravaAuth {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  athlete: Athlete;
}

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

export interface PolylineMap {
  polyline?: string;
  summary_polyline: string;
}

export interface Activity {
  id: string;
  name: string;
  type: ActivityType;
  start_date_local: string; // ISO 8601 format
  timezone: string;
  start_latlng: number[];
  map: PolylineMap;
}

export interface Subscription {
  id: number;
  application_id: number;
  callback_url: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookSubscription {
  'hub.mode': 'subscribe';
  'hub.challenge': string;
  'hub.verify_token': string;
}

export interface WebhookEvent {
  object_type: 'activity' | 'athlete';
  object_id: number;
  aspect_type: 'create' | 'update' | 'delete';
  updates?: Record<string, string>;
  owner_id: number;
  subscription_id: number;
  event_time: number;
}

export class StravaApi {
  private readonly baseUrl = 'https://www.strava.com/api/v3/';
  readonly #clientId: string;
  readonly #clientSecret: string;

  constructor() {
    ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET'].forEach((envvar) => {
      if (!process.env[envvar]) {
        throw new Error(`Missing configuration variable: ${envvar}`);
      }
    });
    this.#clientId = process.env.STRAVA_CLIENT_ID!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    this.#clientSecret = process.env.STRAVA_CLIENT_SECRET!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  }

  public async exchangeTokens(code: string): Promise<StravaAuth> {
    try {
      const response: AxiosResponse<StravaAuth> = await axios.post<StravaAuth>(`${this.baseUrl}oauth/token`, null, {
        params: {
          client_id: this.#clientId,
          client_secret: this.#clientSecret,
          code,
          grant_type: 'authorization_code',
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new AppError(502, 'Error on Strava token exchange request', error);
      }
      throw new AppError(500, 'Error on Strava token exchange request', error);
    }
  }

  public async refreshAuth(token: string): Promise<StravaRefreshAuth> {
    try {
      const response: AxiosResponse<StravaRefreshAuth> = await axios.post<StravaRefreshAuth>(
        `${this.baseUrl}oauth/token`,
        null,
        {
          params: {
            client_id: this.#clientId,
            client_secret: this.#clientSecret,
            refresh_token: token,
            grant_type: 'refresh_token',
          },
        },
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new AppError(502, 'Error on Strava refresh token request', error);
      }
      throw new AppError(500, 'Error on Strava refresh token request', error);
    }
  }

  public async getAthleteActivities(token: string): Promise<Activity[]> {
    try {
      const response = await axios.get<Activity[]>(`${this.baseUrl}athlete/activities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new AppError(502, 'Error on Strava getAthleteActivities request', error);
      }
      throw new AppError(500, 'Error on Strava getAthleteActivities request', error);
    }
  }

  public async getActivity(token: string, id: string): Promise<Activity> {
    try {
      const response = await axios.get<Activity>(`${this.baseUrl}activities/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new AppError(502, 'Error on Strava getActivity request', error);
      }
      throw new AppError(500, 'Error on Strava getActivity request', error);
    }
  }

  public async requestSubscriptionCreation(callbackUrl: string, verifyToken: string): Promise<Subscription> {
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
      if (axios.isAxiosError(error)) {
        throw new AppError(502, 'Error on Strava requestSubscriptionCreation request', error);
      }
      throw new AppError(500, 'Error on Strava requestSubscriptionCreation request', error);
    }
  }

  public async getSubscriptions(): Promise<Subscription[]> {
    try {
      const response = await axios.get<Subscription[]>(`${this.baseUrl}push_subscriptions`, {
        params: { client_id: this.#clientId, client_secret: this.#clientSecret },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new AppError(502, 'Error on Strava getSubscriptions request', error);
      }
      throw new AppError(500, 'Error on Strava getSubscriptions request', error);
    }
  }

  public async deleteSubscription(id: string): Promise<void> {
    try {
      await axios.delete<void>(`${this.baseUrl}push_subscriptions/${id}`, {
        params: { client_id: this.#clientId, client_secret: this.#clientSecret },
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new AppError(502, 'Error on Strava deleteSubscription request', error);
      }
      throw new AppError(500, 'Error on Strava deleteSubscription request', error);
    }
  }
}

export const stravaApi = new StravaApi();
