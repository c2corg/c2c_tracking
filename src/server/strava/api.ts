import axios, { AxiosResponse } from 'axios';
import pino from 'pino';

import { AppError } from '../../errors';

const log = pino();

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
  polyline: string;
  summary_polyline?: string;
}

export interface Activity {
  id: string;
  name: string;
  type: ActivityType;
  start_date_local: string;
  timezone: string;
  start_latlng: number[];
  map: PolylineMap;
}

export interface Subscription {
  id: string;
  application_id: string;
  callback_url: string;
  created_at: string;
  updated_at: string;
}

export class StravaApi {
  private readonly baseUrl = 'https://www.strava.com/api/v3/';
  readonly #clientId: string;
  readonly #clientSecret: string;

  constructor() {
    log.warn(process.env);
    this.#clientId = process.env.STRAVA_CLIENT_ID || '';
    this.#clientSecret = process.env.STRAVA_CLIENT_SECRET || '';
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

  // TODO only retrieve 30 first
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
      const response = await axios.post<Subscription>(`${this.baseUrl}push_subscriptions`, null, {
        params: {
          client_id: this.#clientId,
          client_secret: this.#clientSecret,
          callback_url: callbackUrl,
          verify_token: verifyToken,
        },
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
