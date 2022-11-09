import axios from 'axios';
import { z } from 'zod';

import config from '../../config';
import { handleExternalApiError } from '../../helpers/error';
import log from '../../helpers/logger';

export const SuuntoAuth = z.object({
  access_token: z.string().min(10).max(5000),
  token_type: z.literal('bearer'),
  refresh_token: z.string().min(10).max(5000),
  expires_in: z.number().int().positive(),
  user: z.string().min(1).max(255),
  // scope: 'workout';
  // ukv: string;
  // uk: string;
  // user: string;
  // jti: string;
});
export type SuuntoAuth = z.infer<typeof SuuntoAuth>;

export const SuuntoRefreshAuth = SuuntoAuth.omit({ user: true });
export type SuuntoRefreshAuth = z.infer<typeof SuuntoRefreshAuth>;

export const workoutTypes = [
  'Walking', // 0
  'Running', // 1
  'Cycling', // 2
  'CrossCountrySkiing', // 3
  'Other1', // 4
  'Other2', // 5
  'Other3', // 6
  'Other4', // 7
  'Other5', // 8
  'Other6', // 9
  'MountainBiking', // 10
  'Hiking', // 11
  'RollerSkating', // 12
  'DownhillSkiing', // 13
  'Paddling', // 14
  'Rowing', // 15
  'Golf', // 16
  'Indoor', // 17
  'Parkour', // 18
  'BallGames', // 19
  'OutdoorGym', // 20
  'Swimming', // 21
  'TrailRunning', // 22
  'Gym', // 23
  'NordicWalking', // 24
  'HorsebackRiding', // 25
  'Mototsports', // 26
  'Skateboarding', // 27
  'WaterSports', // 28
  'Climbing', // 29
  'Snowboarding', // 30
  'SkitTouring', // 31
  'FitnessClass', // 32
  'Soccer', // 33
  'Tennis', // 34
  'Basketball', // 35
  'Badminton', // 36
  'Baseball', // 37
  'Volleyball', // 38
  'AmericanFootball', // 39
  'TableTennis', // 40
  'RacquetBall', // 41
  'Squash', // 42
  'Floorball', // 43
  'Handball', // 44
  'Softball', // 45
  'Bowling', // 46
  'Cricket', // 47
  'Rugby', // 48
  'IceSkating', // 49
  'IceHockey', // 50
  'Yoga', // 51
  'IndoorCycling', // 52
  'Treadmill', // 53
  'Crossfit', // 54
  'Crosstrainer', // 55
  'RollerSkiing', // 56
  'IndoorRowing', // 57
  'Stretching', // 58
  'rackAndField', // 59
  'Orienteering', // 60
  'StandupPaddling', // 61
  'CombatSport', // 62
  'Kettlebell', // 63
  'Dancing', // 64
  'SnowShoeing', // 65
  'FrisbeeGolf', // 66
  'Futsal', // 67
  'Multisport', // 68
  'Aerobics', // 69
  'Trekking', // 70
  'Sailing', // 71
  'Kayaking', // 72
  'CircuitTraining', // 73
  'Triathlon', // 74
  undefined,
  'Cheerleading', // 76
  'Boxing', // 77
  'Scubadiving', // 78
  'Freediving', // 79
  'AdventureRacing', // 80
  'Gymnastics', // 81
  'Canoeing', // 82
  'Mountaineering', // 83
  'Telemarkskiing', // 84
  'OpenwaterSwimming', // 85
  'Windsurfing', // 86
  'KitesurfingKiting', // 87
  'Paragliding', // 88
  undefined,
  'Snorkeling', // 90
  'Surfing', // 91
  'Swimrun', // 92
  'Duathlon', // 93
  'Aquathlon', // 94
  'ObstacleRacing', // 95
  'Fishing', // 96
  'Hunting', // 97
  'Transition', // 98
];

export const Position = z.object({
  x: z.number(),
  y: z.number(),
});
export type Position = z.infer<typeof Position>;

export const Workout = z.object({
  workoutId: z.number().int().nonnegative(),
  workoutKey: z.string().min(1).max(255), // Workout unique id
  workoutName: z.string().min(1).max(255).optional(),
  activityId: z.number().int().nonnegative(), // Activity/workout type id. Activity mapping can be found in the FIT file activity id's document (check Suunto App column).
  startTime: z.number().int().positive(), // e.g. 1625986322376 unix epoch with milliseconds
  totalTime: z.number().nonnegative(), // e.g. 6452.1
  totalAscent: z.number().nonnegative(), // meters, float
  totalDistance: z.number().nonnegative(), // meters, float
  timeOffsetInMinutes: z.number().int(), // Timezone offset in minutes. 0 for UTC.
});
export type Workout = z.infer<typeof Workout>;

export const Error = z.object({
  code: z.string().min(1).max(100),
  description: z.string().max(1000),
});
export type Error = z.infer<typeof Error>;

export const Workouts = z.object({
  error: Error.nullish(),
  metadata: z.record(z.string()),
  payload: z.array(Workout),
});
export type Workouts = z.infer<typeof Workouts>;

export const WorkoutSummary = z.object({
  error: Error.nullish(),
  metadata: z.record(z.string()),
  payload: Workout,
});
export type WorkoutSummary = z.infer<typeof WorkoutSummary>;

export const WebhookEvent = z.object({
  username: z.string().min(1).max(255),
  workoutid: z.string().min(1).max(255),
});
export type WebhookEvent = z.infer<typeof WebhookEvent>;

export class SuuntoApi {
  private readonly oauthBaseUrl = 'https://cloudapi-oauth.suunto.com/';
  private readonly baseUrl = 'https://cloudapi.suunto.com/v2/';
  private readonly redirectUrl;
  readonly #clientId: string;
  readonly #clientSecret: string;

  constructor() {
    this.#clientId = config.get('trackers.suunto.clientId');
    this.#clientSecret = config.get('trackers.suunto.clientSecret');
    this.redirectUrl = config.get('c2c.frontend.baseUrl') + config.get('trackers.suunto.redirectPath');
  }

  public async exchangeToken(code: string): Promise<SuuntoAuth> {
    try {
      const response = await axios.post(`${this.oauthBaseUrl}oauth/token`, null, {
        params: {
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUrl,
        },
        auth: {
          username: this.#clientId,
          password: this.#clientSecret,
        },
      });
      return SuuntoAuth.parse(response.data);
    } catch (error: unknown) {
      log.warn(error);
      throw handleExternalApiError('suunto', 'Error on Suunto token exchange request', error);
    }
  }

  public async refreshAuth(token: string): Promise<SuuntoRefreshAuth> {
    try {
      const response = await axios.post(`${this.oauthBaseUrl}oauth/token`, null, {
        params: {
          refresh_token: token,
          grant_type: 'refresh_token',
        },
        auth: {
          username: this.#clientId,
          password: this.#clientSecret,
        },
      });
      return SuuntoRefreshAuth.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('suunto', 'Error on Suunto refresh token request', error);
    }
  }

  public async getWorkouts(token: string, subscriptionKey: string): Promise<Workouts> {
    try {
      const response = await axios.get(`${this.baseUrl}workouts?limit=30`, {
        headers: { Authorization: `Bearer ${token}`, 'Ocp-Apim-Subscription-Key': subscriptionKey },
      });
      return Workouts.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('suunto', 'Error on Suunto getWorkouts request', error);
    }
  }

  // id is workout key
  public async getWorkoutDetails(id: string, token: string, subscriptionKey: string): Promise<WorkoutSummary> {
    try {
      const response = await axios.get(`${this.baseUrl}workouts/${id}`, {
        headers: { Authorization: `Bearer ${token}`, 'Ocp-Apim-Subscription-Key': subscriptionKey },
      });
      return WorkoutSummary.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('suunto', 'Error on Suunto getWorkoutDetails request', error);
    }
  }

  // Id is workout id or key
  public async getFIT(id: string, token: string, subscriptionKey: string): Promise<ArrayBuffer> {
    try {
      const response = await axios.get(`${this.baseUrl}workout/exportFit/${id}`, {
        responseType: 'arraybuffer',
        headers: { Authorization: `Bearer ${token}`, 'Ocp-Apim-Subscription-Key': subscriptionKey },
      });
      return z.instanceof(ArrayBuffer).parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('suunto', 'Error on Suunto getFIT request', error);
    }
  }

  public async deauthorize(token: string): Promise<void> {
    try {
      await axios.get<void>(`${this.oauthBaseUrl}oauth/deauthorize?client_id=${this.#clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error: unknown) {
      throw handleExternalApiError('suunto', 'Error on Suunto deauthorize request', error);
    }
  }
}

export const suuntoApi = new SuuntoApi();
