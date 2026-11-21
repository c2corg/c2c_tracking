import validator from 'validator';
import { z } from 'zod';

import config from '../../config.ts';
import { knownActivityType } from '../../helpers/activity-type.ts';
import { handleExternalApiError } from '../../helpers/error.ts';
import { http } from '../../helpers/http.ts';
import { isISO8601Duration } from '../../helpers/utils.ts';

const PolarAuth = z.object({
  access_token: z.string().min(10).max(100),
  token_type: z.literal('bearer'),
  // see https://github.com/colinhacks/zod/issues/1896
  x_user_id: z
    .any()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .transform((value: any) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return BigInt(value);
      } catch {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return value;
      }
    })
    .pipe(z.bigint()),
});
export type PolarAuth = z.infer<typeof PolarAuth>;

const WebhookType = z.enum(['EXERCISE', 'SLEEP', 'CONTINUOUS_HEART_RATE']);

const CreatedWebhookInfo = z.object({
  data: z.object({
    id: z.string().min(1).max(50),
    events: z.array(WebhookType),
    url: z.string().refine(validator.isURL, {
      message: 'String must be an URL',
    }),
    signature_secret_key: z.string().refine(validator.isUUID, {
      message: 'String must be an UUID',
    }),
  }),
});
export type CreatedWebhookInfo = z.infer<typeof CreatedWebhookInfo>;

const WebhookInfo = z.object({
  data: z
    .array(
      z.object({
        id: z.string(),
        events: z.array(WebhookType),
        url: z.string().refine(validator.isURL, {
          message: 'String must be an URL',
        }),
      }),
    )
    .max(1),
});
export type WebhookInfo = z.infer<typeof WebhookInfo>;

const WebhookPingEvent = z.object({
  event: z.literal('PING'),
  timestamp: z.string().refine(validator.isISO8601, {
    message: 'String must be an ISO-8601 date',
  }),
});
const WebhookExerciseEvent = z.object({
  event: z.literal('EXERCISE'),
  // see https://github.com/colinhacks/zod/issues/1896
  user_id: z
    .any()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .transform((value: any) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return BigInt(value);
      } catch {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return value;
      }
    })
    .pipe(z.bigint()),
  entity_id: z.string().min(1).max(50),
  timestamp: z.string().refine(validator.isISO8601, {
    message: 'String must be an ISO-8601 date',
  }),
});
export const WebhookEvent = WebhookPingEvent.or(WebhookExerciseEvent);
export type WebhookEvent = z.infer<typeof WebhookEvent>;
export type WebhookPingEvent = z.infer<typeof WebhookPingEvent>;
export type WebhookExerciseEvent = z.infer<typeof WebhookExerciseEvent>;
export const isWebhookPingEvent = (event: WebhookEvent): event is WebhookPingEvent => event.event === 'PING';

// detailed sport info values, https://www.polar.com/accesslink-api/ (appendix)
const sportTypes = new Set([
  'AEROBICS',
  'AGILITY',
  'AMERICAN_FOOTBALL',
  'AQUATICS',
  'BACKCOUNTRY_SKIING',
  'BADMINTON',
  'BALLET_DANCING',
  'BALLROOM_DANCING',
  'BASEBALL',
  'BASKETBALL',
  'BEACH_TENNIS',
  'BEACH_VOLLEYBALL',
  'BIATHLON',
  'BODY_AND_MIND',
  'BOOTCAMP',
  'BOXING',
  'CALISTHENICS',
  'CIRCUIT_TRAINING',
  'CLIMBING',
  'CORE',
  'CRICKET',
  'CROSS-COUNTRY_SKIING',
  'CROSS_COUNTRY_RUNNING',
  'CROSS_TRAINER',
  'CURLING',
  'CYCLING',
  'DANCING',
  'DOWNHILL_SKIING',
  'DUATHLON',
  'DUATHLON_CYCLING',
  'DUATHLON_RUNNING',
  'ESPORTS',
  'E_BIKE',
  'FIELD_HOCKEY',
  'FINNISH_BASEBALL',
  'FITNESS_BOXING',
  'FITNESS_DANCING',
  'FITNESS_MARTIAL_ARTS',
  'FITNESS_RACING',
  'FITNESS_STEP',
  'FLOORBALL',
  'FREE_MULTISPORT',
  'FRISBEEGOLF',
  'FUNCTIONAL_TRAINING',
  'FUTSAL',
  'GOLF',
  'GRAVEL',
  'GROUP_EXERCISE',
  'GYMNASTICK',
  'HANDBALL',
  'HIIT',
  'HIKING',
  'ICE_HOCKEY',
  'ICE_SKATING',
  'INDOOR_CYCLING',
  'INDOOR_ROWING',
  'INLINE_SKATING',
  'JAZZ_DANCING',
  'JOGGING',
  'JUDO_MARTIAL_ARTS',
  'JUMP_ROPE',
  'KETTLEBELL',
  'KICKBIKE',
  'KICKBOXING_MARTIAL_ARTS',
  'LATIN_DANCING',
  'LES_MILLS_BARRE',
  'LES_MILLS_BODYATTACK',
  'LES_MILLS_BODYBALANCE',
  'LES_MILLS_BODYCOMBAT',
  'LES_MILLS_BODYJAM',
  'LES_MILLS_BODYPUMP',
  'LES_MILLS_BODYSTEP',
  'LES_MILLS_CXWORKS',
  'LES_MILLS_GRIT_ATHLETIC',
  'LES_MILLS_GRIT_CARDIO',
  'LES_MILLS_GRIT_STRENGTH',
  'LES_MILLS_RPM',
  'LES_MILLS_SHBAM',
  'LES_MILLS_SPRINT',
  'LES_MILLS_TONE',
  'LES_MILLS_TRIP',
  'MOBILITY_DYNAMIC',
  'MOBILITY_STATIC',
  'MODERN_DANCING',
  'MOTORSPORTS_CAR_RACING',
  'MOTORSPORTS_ENDURO',
  'MOTORSPORTS_HARD_ENDURO',
  'MOTORSPORTS_MOTOCROSS',
  'MOTORSPORTS_ROADRACING',
  'MOTORSPORTS_SNOCROSS',
  'MOUNTAIN_BIKING',
  'NORDIC_WALKING',
  'OBSTACLE_COURSE_RACING',
  'OFFROADDUATHLON',
  'OFFROADDUATHLON_CYCLING',
  'OFFROADDUATHLON_RUNNING',
  'OFFROADTRIATHLON',
  'OFFROADTRIATHLON_CYCLING',
  'OFFROADTRIATHLON_RUNNING',
  'OFFROADTRIATHLON_SWIMMING',
  'OPEN_WATER_SWIMMING',
  'ORIENTEERING',
  'ORIENTEERING_MTB',
  'ORIENTEERING_SKI',
  'OTHER_INDOOR',
  'OTHER_OUTDOOR',
  'PADEL',
  'PARASPORTS_HAND_CYCLING',
  'PARASPORTS_SLED_HOCKEY',
  'PARASPORTS_WATER_SKIING',
  'PARASPORTS_WHEELCHAIR',
  'PARASPORTS_WHEELCHAIR_BASKETBALL',
  'PARASPORTS_WHEELCHAIR_TENNIS',
  'PICKLEBALL',
  'PILATES',
  'POOL_SWIMMING',
  'RIDING',
  'RINGETTE',
  'ROAD_BIKING',
  'ROAD_RUNNING',
  'ROLLER_BLADING',
  'ROLLER_SKIING_CLASSIC',
  'ROLLER_SKIING_FREESTYLE',
  'ROWING',
  'RUCKING',
  'RUGBY',
  'RUNNING',
  'SHOOTING_SPORT_INDOOR',
  'SHOOTING_SPORT_OUTDOOR',
  'SHOW_DANCING',
  'SKATEBOARDING',
  'SKATING',
  'SKIERG',
  'SNOWBOARDING',
  'SNOWSHOE_TREKKING',
  'SOCCER',
  'SPINNING',
  'SQUASH',
  'STAIR_WORKOUT',
  'STREET_DANCING',
  'STRENGTH_TRAINING',
  'STRETCHING',
  'SUP',
  'SWIMMING',
  'TABLE_TENNIS',
  'TAEKWONDO_MARTIAL_ARTS',
  'TELEMARK_SKIING',
  'TENNIS',
  'TRACK_AND_FIELD_RUNNING',
  'TRAIL_RUNNING',
  'TREADMILL_RUNNING',
  'TRIATHLON',
  'TRIATHLON_CYCLING',
  'TRIATHLON_RUNNING',
  'TRIATHLON_SWIMMING',
  'TROTTING',
  'ULTIMATE',
  'ULTRARUNNING_RUNNING',
  'VERTICALSPORTS_OUTCLIMBING',
  'VERTICALSPORTS_WALLCLIMBING',
  'VOLLEYBALL',
  'WALKING',
  'WATERSPORTS_CANOEING',
  'WATERSPORTS_KAYAKING',
  'WATERSPORTS_KITESURFING',
  'WATERSPORTS_SAILING',
  'WATERSPORTS_SURFING',
  'WATERSPORTS_WAKEBOARDING',
  'WATERSPORTS_WATERSKI',
  'WATERSPORTS_WINDSURFING',
  'WATER_EXERCISE',
  'WATER_RUNNING',
  'XC_SKIING_CLASSIC',
  'XC_SKIING_FREESTYLE',
  'YOGA',
]);

const Exercise = z.object({
  id: z.string().min(1).max(50),
  start_time: z.string().refine(validator.isISO8601, {
    message: 'String must be an ISO-8601 date',
  }),
  start_time_utc_offset: z.number().int(),
  duration: z.string().optional().refine(isISO8601Duration, {
    message: 'String must be an ISO-8601 duration',
  }),
  distance: z.number().nonnegative().optional(), // meters
  sport: z.string().max(100).optional(),
  detailed_sport_info: z.string().max(100).optional(),
});
export type Exercise = z.infer<typeof Exercise>;

/**
 * The exercise's activity type: the known list holds detailed sport info values, sport is the fallback.
 */
export const sportType = ({ sport, detailed_sport_info }: Exercise): string =>
  detailed_sport_info && sportTypes.has(detailed_sport_info)
    ? detailed_sport_info
    : knownActivityType('polar', sport, sportTypes);

export class PolarApi {
  private readonly baseUrl = 'https://www.polaraccesslink.com/v3/';
  private readonly redirectUrl: string;
  public readonly webhookCallbackUrl: string;
  readonly #clientId: string;
  readonly #clientSecret: string;

  constructor() {
    this.#clientId = config.get('trackers.polar.clientId');
    this.#clientSecret = config.get('trackers.polar.clientSecret');
    this.redirectUrl =
      config.get('c2c.frontend.baseUrl') + config.get('c2c.frontend.subscriptionPath') + '/polar/exchange-token';
    this.webhookCallbackUrl = config.get('server.baseUrl') + 'polar/webhook';
  }

  public async exchangeToken(code: string): Promise<PolarAuth> {
    try {
      const response = await http.post(
        'https://polarremote.com/v2/oauth2/token',
        {
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUrl,
        },
        {
          auth: { username: this.#clientId, password: this.#clientSecret },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
      return PolarAuth.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('polar', 'Error on Polar token exchange request', error);
    }
  }

  public async registerUser(token: string, userId: bigint): Promise<void> {
    try {
      await http.post(
        `${this.baseUrl}users`,
        { 'member-id': userId.toString() },
        {
          headers: { Authorization: `Bearer ${token}` },
          validateStatus(status) {
            return status === 200 || status === 409; // 409: already registered
          },
        },
      );
    } catch (error: unknown) {
      throw handleExternalApiError('polar', 'Error on Polar register user request', error);
    }
  }

  public async deleteUser(token: string, userId: bigint): Promise<void> {
    try {
      await http.delete(`${this.baseUrl}users/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
    } catch (error: unknown) {
      throw handleExternalApiError('polar', 'Error on Polar delete user request', error);
    }
  }

  public async getExercise(token: string, exerciseId: string): Promise<Exercise> {
    try {
      const response = await http.get(`${this.baseUrl}exercises/${encodeURIComponent(exerciseId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return Exercise.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('polar', 'Error on Polar delete user request', error);
    }
  }

  public async getExerciseFit(token: string, exerciseId: string): Promise<ArrayBuffer> {
    try {
      const response = await http.get<ArrayBuffer>(`${this.baseUrl}exercises/${encodeURIComponent(exerciseId)}/fit`, {
        responseType: 'arraybuffer',
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error: unknown) {
      throw handleExternalApiError('polar', 'Error on Polar getExrciseFIT request', error);
    }
  }

  public async createWebhook(): Promise<string> {
    try {
      const response = await http.post(
        `${this.baseUrl}webhooks`,
        {
          events: ['EXERCISE'],
          url: this.webhookCallbackUrl,
        },
        { auth: { username: this.#clientId, password: this.#clientSecret } },
      );
      return CreatedWebhookInfo.parse(response.data).data.signature_secret_key;
    } catch (error: unknown) {
      throw handleExternalApiError('polar', 'Error on Polar create webhook request', error);
    }
  }

  public async getWebhook(): Promise<WebhookInfo> {
    try {
      const response = await http.get(`${this.baseUrl}webhooks`, {
        auth: { username: this.#clientId, password: this.#clientSecret },
      });
      return WebhookInfo.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('polar', 'Error on Polar get webhook request', error);
    }
  }
}

export const polarApi = new PolarApi();
