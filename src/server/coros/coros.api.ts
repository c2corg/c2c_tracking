import { z } from 'zod';

import config from '../../config.ts';
import { ExternalApiError } from '../../errors.ts';
import { unknownActivityType } from '../../helpers/activity-type.ts';
import { handleExternalApiError } from '../../helpers/error.ts';
import { isExternalUrl } from '../../helpers/external-url.ts';
import { http } from '../../helpers/http.ts';

export const CorosAuth = z.object({
  access_token: z.string().min(5).max(50),
  refresh_token: z.string().min(5).max(50),
  openId: z.string(),
});

export type CorosAuth = z.infer<typeof CorosAuth>;

export const Workout = z.object({
  labelId: z.string().regex(/\d+/),
  mode: z.number().int().nonnegative(),
  subMode: z.number().int().nonnegative(),
  distance: z.number().nonnegative().optional(),
  duration: z.number().int().nonnegative().optional(),
  startTime: z.number().int().positive(),
  endTime: z.number().int().positive(),
  startTimezone: z.number().int().positive().max(96),
  endTimezone: z.number().int().positive().max(96),
  fitUrl: z.url().optional(),
  triathlonItemList: z
    .array(
      z.object({
        mode: z.number().int().nonnegative(),
        subMode: z.number().int().nonnegative(),
        distance: z.number().nonnegative().optional(),
        duration: z.number().int().nonnegative().optional(),
        fitUrl: z.url().optional(),
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

// COROS API Reference V2.1.1, Appendix 3: Workout types (https://github.com/coroslab/coros-open-api)
// keyed by mode/subMode: mode * 10 + subMode would be ambiguous for a subMode above 9
const sportTypes = new Map<string, string>([
  ['8/1', 'Outdoor Run'],
  ['8/2', 'Indoor Run'],
  ['9/1', 'Outdoor Bike'],
  ['9/2', 'Indoor Bike'],
  ['9/3', 'E-Bike'],
  ['9/4', 'Mountain Bike'],
  ['9/5', 'E-Mountain Bike'],
  ['9/6', 'Gravel Bike'],
  ['10/1', 'Open Water'],
  ['10/2', 'Pool Swim'],
  ['13/1', 'Triathlon'],
  ['13/2', 'Multisport'],
  ['13/3', 'Ski Touring'],
  ['13/4', 'Outdoor Climb'],
  ['14/1', 'Mountain Climb'],
  ['15/1', 'Trail Run'],
  ['16/1', 'Hike'],
  ['18/1', 'GPS Cardio'],
  ['18/2', 'Gym Cardio'],
  ['19/1', 'XC Ski'],
  ['20/1', 'Track Run'],
  ['21/1', 'Ski'],
  ['21/2', 'Snowboard'],
  ['22/1', 'Pilot'],
  ['23/2', 'Strength'],
  ['24/1', 'Rowing'],
  ['24/2', 'Indoor Rower'],
  ['25/1', 'Whitewater'],
  ['26/1', 'Flatwater'],
  ['27/1', 'Windsurfing'],
  ['28/1', 'Speedsurfing'],
  ['29/1', 'Ski Touring'],
  ['30/1', 'Multi-Pitch'],
  ['31/1', 'Walk'],
  ['32/1', 'Boat Fishing'],
  ['32/2', 'Shore Fishing'],
  ['32/4', 'Kayak Fishing'],
  ['32/5', 'Inshore Fishing'],
  ['32/6', 'Offshore Fishing'],
  ['32/7', 'Boat Fly Fishing'],
  ['32/8', 'Shore Fly Fishing'],
  ['32/9', 'Surf Fishing'],
  ['33/2', 'Single-Pitch'],
  ['33/3', 'Bouldering'],
  ['34/2', 'Jump Rope'],
  ['35/2', 'Stair Climber'],
  ['36/2', 'Badminton'],
  ['37/2', 'Table Tennis'],
  ['38/1', 'Basketball'],
  ['39/1', 'Soccer'],
  ['40/1', 'Pickleball'],
  ['41/2', 'Elliptical'],
  ['42/2', 'Yoga'],
  ['43/2', 'Pilates'],
  ['44/2', 'Boxing'],
  ['45/1', 'Frisbee'],
  ['46/1', 'Skateboard'],
  ['47/1', 'Tennis'],
  ['48/1', 'Padel'],
  ['49/1', 'Outdoor Climbing'],
  ['50/2', 'Mixed Training'],
  ['98/1', 'Custom Sport Outdoor'],
  ['99/2', 'Custom Sport Indoor'],
]);

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
      const response = await http.post(
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
      await http.post<void>(
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
      await http.post(
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
      const response = await http.get(`${this.#baseUrl}v2/coros/sport/list`, {
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
      const response = await http.get<ArrayBuffer>(`${this.#baseUrl}v2/coros/sport/detail/fit`, {
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
    // the URL comes from the webhook event: never fetch an internal resource with it
    if (!isExternalUrl(url)) {
      throw new ExternalApiError(`Coros FIT URL refused, not an external URL: ${url}`);
    }
    try {
      const response = await http.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
      });
      return response.data;
    } catch (error: unknown) {
      throw handleExternalApiError('coros', 'Error on Coros getFIT request', error);
    }
  }

  public getSport(mode: number, subMode: number): string {
    return this.findSport(mode, subMode) ?? unknownActivityType('coros', `${mode}/${subMode}`);
  }

  public findSport(mode: number, subMode: number): string | undefined {
    return sportTypes.get(`${mode}/${subMode}`);
  }
}

export const corosApi = new CorosApi();
