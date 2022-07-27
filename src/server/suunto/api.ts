import axios from 'axios';
import pino from 'pino';

import { handleAppError } from '../../helpers/error';

const log = pino();

export type SuuntoAuth = {
  access_token: string;
  token_type: 'bearer';
  refresh_token: string;
  expires_in: number;
  user: string;
  // scope: 'workout';
  // ukv: string;
  // uk: string;
  // user: string;
  // jti: string;
};

export type SuuntoRefreshAuth = Omit<SuuntoAuth, 'user'>;

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

export type Position = {
  x: number;
  y: number;
};

export type Workout = {
  workoutId: number;
  workoutKey: string; // Workout unique id
  workoutName: string;
  activityId: number; // Activity/workout type id. Activity mapping can be found in the FIT file activity id's document (check Suunto App column).
  description: string;
  startTime: number; // e.g. 1625986322376 unix epoch with milliseconds
  totalTime: number; // e.g. 6452.1
  timeOffsetInMinutes: number; // Timezone offset in minutes. 0 for UTC.
};

export type Error = {
  code: string;
  description: string;
};

export type Workouts = {
  error?: Error | null;
  metadata: { [key: string]: string };
  payload: Workout[];
};

export type WorkoutSummary = {
  error?: Error | null;
  metadata: { [key: string]: string };
  payload: Workout;
};

export type WebhookEvent = {
  username: string;
  workoutid: number;
};

export class SuuntoApi {
  private readonly oauthBaseUrl = 'https://cloudapi-oauth.suunto.com/';
  private readonly baseUrl = 'https://cloudapi.suunto.com/v2/';
  private readonly redirectUrl;
  readonly #clientId: string;
  readonly #clientSecret: string;

  constructor() {
    this.#clientId = process.env['SUUNTO_CLIENT_ID']!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    this.#clientSecret = process.env['SUUNTO_CLIENT_SECRET']!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    this.redirectUrl = process.env['SUUNTO_REDIRECT_URI']!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  }

  async exchangeTokens(code: string): Promise<SuuntoAuth> {
    try {
      const response = await axios.post<SuuntoAuth>(`${this.oauthBaseUrl}oauth/token`, null, {
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
      return response.data;
    } catch (error) {
      log.error(error);
      throw handleAppError(502, 'Error on Suunto token exchange request', error);
    }
  }

  async refreshAuth(token: string): Promise<SuuntoRefreshAuth> {
    try {
      const response = await axios.post<SuuntoRefreshAuth>(`${this.oauthBaseUrl}oauth/token`, null, {
        params: {
          refresh_token: token,
          grant_type: 'refresh_token',
        },
        auth: {
          username: this.#clientId,
          password: this.#clientSecret,
        },
      });
      return response.data;
    } catch (error) {
      throw handleAppError(502, 'Error on Suunto refresh token request', error);
    }
  }

  async getWorkouts(token: string, subscriptionKey: string): Promise<Workouts> {
    try {
      const response = await axios.get<Workouts>(`${this.baseUrl}workouts?limit=30`, {
        headers: { Authorization: `Bearer ${token}`, 'Ocp-Apim-Subscription-Key': subscriptionKey },
      });
      return response.data;
    } catch (error) {
      throw handleAppError(502, 'Error on Strava getWorkouts request', error);
    }
  }

  async getWorkoutDetails(token: string, id: number, subscriptionKey: string): Promise<WorkoutSummary> {
    try {
      const response = await axios.get<WorkoutSummary>(`${this.baseUrl}workouts/${id}`, {
        headers: { Authorization: `Bearer ${token}`, 'Ocp-Apim-Subscription-Key': subscriptionKey },
      });
      return response.data;
    } catch (error) {
      throw handleAppError(502, 'Error on Strava getWorkoutDetails request', error);
    }
  }

  // Id is workout id or key
  async getFIT(token: string, id: string): Promise<Buffer> {
    try {
      const response = await axios.get<Buffer>(`${this.baseUrl}workout/exportFit${id}`, {
        responseType: 'arraybuffer',
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      throw handleAppError(502, 'Error on Strava getActivity request', error);
    }
  }

  async deauthorize(token: string): Promise<void> {
    try {
      const response = await axios.get<void>(`${this.oauthBaseUrl}oauth/deauthorize?client_id=${this.#clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      log.error(error);
      throw handleAppError(502, 'Error on Strava deauthorize request', error);
    }
  }
}

export const suuntoApi = new SuuntoApi();
