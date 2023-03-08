import axios from 'axios';
import { z } from 'zod';

import config from '../../config';
import { handleExternalApiError } from '../../helpers/error';

export const CorosAuth = z.object({
  access_token: z.string().min(5).max(50),
  refresh_token: z.string().min(5).max(50),
  openId: z.string(),
});

export type CorosAuth = z.infer<typeof CorosAuth>;

export const Workout = z.object({
  labelId: z.string().regex(/\d+/),
  mode: z.number().int().positive().max(99),
  subMode: z.number().int().positive().max(99),
  distance: z.number().nonnegative().optional(),
  duration: z.number().int().nonnegative().optional(),
  startTime: z.number().int().positive(),
  endTime: z.number().int().positive(),
  startTimezone: z.number().int().positive().max(96),
  endTimezone: z.number().int().positive().max(96),
  fitUrl: z.string().url().optional(),
  triathlonItemList: z
    .array(
      z.object({
        mode: z.number().int().positive().max(99),
        subMode: z.number().int().positive().max(99),
        distance: z.number().nonnegative().optional(),
        duration: z.number().int().nonnegative().optional(),
        fitUrl: z.string().url().optional(),
      }),
    )
    .optional(),
});

export type Workout = z.infer<typeof Workout>;

export const WorkoutRecords = z.object({
  result: z.string().regex(/\d{4,10}/),
  message: z.string(),
  data: z.array(Workout),
});

export type WorkoutRecords = z.infer<typeof WorkoutRecords>;

export const WorkoutRecord = z.object({
  result: z.string().regex(/\d{4,10}/),
  message: z.string(),
  data: Workout,
});

export type WorkoutRecord = z.infer<typeof WorkoutRecord>;

export const WebhookEvent = z.object({
  sportDataList: z.array(
    Workout.extend({
      openId: z.string(),
    }),
  ),
});

export type WebhookEvent = z.infer<typeof WebhookEvent>;

const sportType = new Map<number, string>();
sportType.set(801, 'Outdoor Run');
sportType.set(802, 'Indoor Run');
sportType.set(901, 'Outdoor Bike');
sportType.set(902, 'Indoor Bike');
sportType.set(101, 'Open Water');
sportType.set(102, 'Pool Swim');
sportType.set(131, 'Triathlon');
sportType.set(132, 'Multisport');
sportType.set(133, 'Ski Touring');
sportType.set(141, 'Mountain Climb');
sportType.set(151, 'Trail Run');
sportType.set(161, 'Hike');
sportType.set(181, 'GPS Cardio');
sportType.set(182, 'Gym Cardio');
sportType.set(191, 'XC Ski');
sportType.set(201, 'Track Run');
sportType.set(211, 'Ski');
sportType.set(212, 'Snowboard');
sportType.set(221, 'Pilot');
sportType.set(232, 'Strength');
sportType.set(241, 'Rowing');
sportType.set(242, 'Indoor Rower');
sportType.set(251, 'Whitewater');
sportType.set(261, 'Flatwater');
sportType.set(271, 'Windsurfing');
sportType.set(281, 'Speedsurfing');
sportType.set(291, 'Ski Touring');
sportType.set(311, 'Walk');
sportType.set(332, 'Single-Pitch');
sportType.set(342, 'Jump Rope');

export class CorosApi {
  private readonly redirectUrl: string;
  readonly #baseUrl: string;
  readonly #clientId: string;
  readonly #clientSecret: string;

  constructor() {
    this.#baseUrl = config.get('trackers.coros.baseUrl');
    this.#clientId = config.get('trackers.coros.clientId');
    this.#clientSecret = config.get('trackers.coros.clientSecret');
    this.redirectUrl =
      config.get('c2c.frontend.baseUrl') + config.get('c2c.frontend.subscriptionPath') + '/coros/exchange-token';
  }

  public async exchangeToken(code: string): Promise<CorosAuth> {
    try {
      const response = await axios.post(
        `${this.#baseUrl}oauth2/accesstoken`,
        {
          client_id: this.#clientId,
          client_secret: this.#clientSecret,
          redirect_uri: this.redirectUrl,
          code,
          grant_type: 'authorization_code',
        },
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
      return CorosAuth.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('coros', 'Error on Coros token exchange request', error);
    }
  }

  public async deauthorize(accessToken: string): Promise<void> {
    try {
      await axios.post<void>(
        `${this.#baseUrl}oauth2/deauthorize`,
        { token: accessToken },
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
    } catch (error: unknown) {
      throw handleExternalApiError('coros', 'Error on Coros deauthorize request', error);
    }
  }

  public async refreshAuth(refreshToken: string): Promise<void> {
    try {
      await axios.post(
        `${this.#baseUrl}oauth2/refresh-token`,
        {
          client_id: this.#clientId,
          client_secret: this.#clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        },
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
    } catch (error: unknown) {
      throw handleExternalApiError('coros', 'Error on Coros refresh token request', error);
    }
  }

  public async getWorkouts(
    accessToken: string,
    openId: string,
    startDate: number,
    endDate: number,
  ): Promise<WorkoutRecords> {
    try {
      const response = await axios.get(`${this.#baseUrl}v2/coros/sport/list`, {
        params: { token: accessToken, openId, startDate, endDate },
      });
      return WorkoutRecords.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('coros', 'Error on Coros getWorkouts request', error);
    }
  }

  public async getWorkoutDetails(
    accessToken: string,
    workoutId: string,
    mode: number,
    subMode: number,
    userId: string,
  ): Promise<WorkoutRecord> {
    try {
      const response = await axios.get<ArrayBuffer>(`${this.#baseUrl}v2/coros/sport/detail/fit`, {
        responseType: 'arraybuffer',
        params: {
          token: accessToken,
          openId: userId,
          mode,
          subMode,
          labelId: workoutId,
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return WorkoutRecord.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('coros', 'Error on Coros getWorkoutDetails request', error);
    }
  }

  public async getFIT(url: string): Promise<ArrayBuffer> {
    try {
      const response = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
      });
      return response.data;
    } catch (error: unknown) {
      throw handleExternalApiError('coros', 'Error on Coros getFIT request', error);
    }
  }

  public getSport(mode: number, subMode: number): string {
    return sportType.get(mode * 100 + subMode) ?? 'Unknown';
  }
}

export const corosApi = new CorosApi();
