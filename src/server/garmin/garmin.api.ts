import { createHmac, randomBytes } from 'crypto';

import axios from 'axios';
import dayjs from 'dayjs';
import dayjsPluginUTC from 'dayjs/plugin/utc';
import { z } from 'zod';

import config from '../../config';
import { ExternalApiError } from '../../errors';
import { handleExternalApiError } from '../../helpers/error';

dayjs.extend(dayjsPluginUTC);

export const GarminAuth = z.object({
  token: z.string().min(10).max(5000),
  tokenSecret: z.string().min(10).max(5000),
});
export type GarminAuth = z.infer<typeof GarminAuth>;

const activityTypes = [
  'RUNNING',
  'INDOOR_RUNNING',
  'OBSTACLE_RUN',
  'STREET_RUNNING',
  'TRACK_RUNNING',
  'TRAIL_RUNNING',
  'TREADMILL_RUNNING',
  'ULTRA_RUN',
  'VIRTUAL_RUN',
  'CYCLING',
  'BMX',
  'CYCLOCROSS',
  'DOWNHILL_BIKING',
  'GRAVEL_CYCLING',
  'INDOOR_CYCLING',
  'MOUNTAIN_BIKING',
  'RECUMBENT_CYCLING',
  'ROAD_BIKING',
  'TRACK_CYCLING',
  'VIRTUAL_RIDE',
  'FITNESS_EQUIPMENT',
  'BOULDERING',
  'ELLIPTICAL',
  'INDOOR_CARDIO',
  'INDOOR_CLIMBING',
  'INDOOR_ROWING',
  'PILATES',
  'STAIR_CLIMBING',
  'STRENGTH_TRAINING',
  'YOGA',
  'HIKING',
  'SWIMMING',
  'LAP_SWIMMING',
  'OPEN_WATER_SWIMMING',
  'WALKING',
  'CASUAL_WALKING',
  'SPEED_WALKING',
  'TRANSITION',
  'BIKETORUNTRANSITION',
  'RUNTOBIKETRANSITION',
  'SWIMTOBIKETRANSITION',
  'MOTORCYCLING',
  'ATV',
  'MOTOCROSS',
  'OTHER',
  'AUTO_RACING',
  'BOATING',
  'BREATHWORK',
  'DRIVING_GENERAL',
  'E_SPORT',
  'FLOOR_CLIMBING',
  'FLYING',
  'GOLF',
  'HANG_GLIDING',
  'HORSEBACK_RIDING',
  'HUNTING_FISHING',
  'HUNTING',
  'FISHING',
  'INLINE_SKATING',
  'MOUNTAINEERING',
  'OFFSHORE_GRINDING',
  'ONSHORE_GRINDING',
  'PADDLING',
  'RC_DRONE',
  'ROCK_CLIMBING',
  'ROWING',
  'SAILING',
  'SKY_DIVING',
  'STAND_UP_PADDLEBOARDING',
  'STOPWATCH',
  'SURFING',
  'TENNIS',
  'WAKEBOARDING',
  'WHITEWATER_RAFTING_KAYAKING',
  'WIND_KITE_SURFING',
  'WINGSUIT_FLYING',
  'DIVING',
  'APNEA_DIVING',
  'APNEA_HUNT',
  'CCR_DIVE',
  'GAUGE_DIVING',
  'MULTI_GAS_DIVING',
  'SINGLE_GAS_DIVING',
  'WINTER_SPORTS',
  'BACKCOUNTRY_SKIING_SNOWBOARDING_WS',
  'CROSS_COUNTRY_SKIING_WS',
  'RESORT_SKIING_SNOWBOARDING_WS',
  'SKATE_SKIING_WS',
  'SKATING_WS',
  'SNOW_SHOE_WS',
  'SNOWMOBILING_WS',
];
export const GarminActivityType = z.preprocess((val) => {
  const s = String(val).toUpperCase();
  if (activityTypes.includes(s)) {
    return s;
  }
  return 'UNKNOWN';
}, z.string());
export type GarminActivityType = z.infer<typeof GarminActivityType>;

export const GarminActivitySummary = z.object({
  activityType: GarminActivityType,
  startTimeInSeconds: z.number().int().positive(),
  durationInSeconds: z.number().int().nonnegative().optional(), // integer
  distanceInMeters: z.number().nonnegative().optional(), // float
  totalElevationGainInMeters: z.number().nonnegative().optional(), // float
});
export type GarminActivitySummary = z.infer<typeof GarminActivitySummary>;

export const GarminSample = z.object({
  startTimeInSeconds: z.number().int().positive().optional(),
  latitudeInDegree: z.number().optional(),
  longitudeInDegree: z.number().optional(),
  elevationInMeters: z.number().optional(),
});
export type GarminSample = z.infer<typeof GarminSample>;

export const GarminActivity = z.object({
  activityId: z.number().int().positive(),
  summary: GarminActivitySummary,
  samples: z.array(GarminSample).optional(),
});
export type GarminActivity = z.infer<typeof GarminActivity>;

dayjs.extend(dayjsPluginUTC);

export class GarminApi {
  private readonly oauthUrl = 'https://connectapi.garmin.com/oauth-service/';
  private readonly apiUrl = 'https://apis.garmin.com/';
  readonly #consumerKey: string;
  readonly #consumerSecret: string;

  constructor() {
    this.#consumerKey = config.get('trackers.garmin.consumerKey');
    this.#consumerSecret = config.get('trackers.garmin.consumerSecret');
  }

  public async requestUnauthorizedRequestToken(): Promise<GarminAuth> {
    try {
      const timestamp = dayjs().unix();
      const nonce = randomBytes(16).toString('hex');
      const signature = encodeURIComponent(this.generateUnauthorizedRequestTokenSignature(timestamp, nonce));
      const authorization = `OAuth oauth_nonce="${nonce}", oauth_signature="${signature}", oauth_consumer_key="${
        this.#consumerKey
      }", oauth_timestamp="${timestamp}", oauth_signature_method="HMAC-SHA1", oauth_version="1.0"`;
      const response = await axios.post(`${this.oauthUrl}oauth/request_token`, null, {
        headers: { Authorization: authorization },
        responseType: 'text',
      });
      const found = /oauth_token=([\w-]+)&oauth_token_secret=([\w-]+)/.exec(z.string().parse(response.data));
      if (!found || found.length < 3) {
        throw new ExternalApiError('Unable to acquire Garmin unauthorized request token');
      }
      return { token: found[1]!, tokenSecret: found[2]! }; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    } catch (error: unknown) {
      throw handleExternalApiError('garmin', 'Unable to acquire Garmin unauthorized request token', error);
    }
  }

  private generateUnauthorizedRequestTokenSignature(timestamp: number, nonce: string): string {
    const normalizedParameters = `oauth_consumer_key=${
      this.#consumerKey
    }&oauth_nonce=${nonce}&oauth_signature_method=HMAC-SHA1&oauth_timestamp=${timestamp}&oauth_version=1.0`;
    const signatureBaseString = `POST&${encodeURIComponent(this.oauthUrl + 'oauth/request_token')}&${encodeURIComponent(
      normalizedParameters,
    )}`;
    return createHmac('sha1', `${this.#consumerSecret}&`).update(signatureBaseString).digest('base64');
  }

  public async exchangeToken(requestToken: string, requestTokenSecret: string, verifier: string): Promise<GarminAuth> {
    try {
      const timestamp = dayjs().unix();
      const nonce = randomBytes(16).toString('hex');
      const signature = encodeURIComponent(
        this.generateExchangeTokenSignature(timestamp, nonce, requestToken, requestTokenSecret, verifier),
      );
      const authorization = `OAuth oauth_verifier="${verifier}", oauth_version="1.0", oauth_consumer_key="${
        this.#consumerKey
      }", oauth_token="${requestToken}", oauth_timestamp="${timestamp}", oauth_nonce="${nonce}", oauth_signature_method="HMAC-SHA1", oauth_signature="${signature}"`;
      const response = await axios.post<string>(`${this.oauthUrl}oauth/access_token`, null, {
        headers: { Authorization: authorization },
        responseType: 'text',
      });
      const found = /oauth_token=([\w-]+)&oauth_token_secret=([\w-]+)/.exec(z.string().parse(response.data));
      if (!found || found.length < 3) {
        throw new ExternalApiError('Unable to acquire Garmin access request token');
      }
      return { token: found[1]!, tokenSecret: found[2]! }; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    } catch (error: unknown) {
      throw handleExternalApiError('garmin', 'Unable to acquire Garmin access request token', error);
    }
  }

  private generateExchangeTokenSignature(
    timestamp: number,
    nonce: string,
    token: string,
    tokenSecret: string,
    verifier: string,
  ): string {
    const normalizedParameters = `oauth_consumer_key=${
      this.#consumerKey
    }&oauth_nonce=${nonce}&oauth_signature_method=HMAC-SHA1&oauth_timestamp=${timestamp}&oauth_token=${token}&oauth_verifier=${verifier}&oauth_version=1.0`;
    const signatureBaseString = `POST&${encodeURIComponent(this.oauthUrl + 'oauth/access_token')}&${encodeURIComponent(
      normalizedParameters,
    )}`;
    return createHmac('sha1', `${this.#consumerSecret}&${tokenSecret}`).update(signatureBaseString).digest('base64');
  }

  public async getActivitiesForDay(date: Date, token: string, tokenSecret: string): Promise<GarminActivity[]> {
    try {
      const url = `${this.apiUrl}wellness-api/rest/activityDetails`;
      const end = dayjs(date).utc().endOf('day').unix();
      const start = dayjs(date).utc().startOf('day').unix();
      const response = await axios.get(`${url}?uploadStartTimeInSeconds=${start}&uploadEndTimeInSeconds=${end}`, {
        headers: { Authorization: this.generateApiRequestAuth('GET', url, token, tokenSecret, start, end) },
      });
      return z.array(GarminActivity).parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('garmin', 'Unable to rtrieve Garmin activities for day', error);
    }
  }

  public async deauthorize(token: string, tokenSecret: string): Promise<void> {
    try {
      const url = `${this.apiUrl}wellness-api/rest/user/registration`;
      await axios.delete<void>(`${url}`, {
        headers: {
          Authorization: this.generateApiRequestAuth('DELETE', url, token, tokenSecret),
        },
      });
    } catch (error: unknown) {
      throw handleExternalApiError('garmin', 'Error on Garmin deauthorize request', error);
    }
  }

  private generateApiRequestAuth(
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    token: string,
    tokenSecret: string,
    start?: number,
    end?: number,
  ): string {
    const timestamp = dayjs().unix();
    const nonce = randomBytes(16).toString('hex');
    let normalizedParameters = `oauth_consumer_key=${
      this.#consumerKey
    }&oauth_nonce=${nonce}&oauth_signature_method=HMAC-SHA1&oauth_timestamp=${timestamp}&oauth_token=${token}&oauth_version=1.0`;
    if (start != undefined && end != undefined) {
      normalizedParameters += `&uploadEndTimeInSeconds=${end}&uploadStartTimeInSeconds=${start}`;
    }
    const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(normalizedParameters)}`;
    const signature = encodeURIComponent(
      createHmac('sha1', `${this.#consumerSecret}&${tokenSecret}`).update(signatureBaseString).digest('base64'),
    );
    return `OAuth oauth_nonce="${nonce}", oauth_signature="${signature}", oauth_token="${token}", oauth_consumer_key="${
      this.#consumerKey
    }", oauth_timestamp="${timestamp}", oauth_signature_method="HMAC-SHA1", oauth_version="1.0"`;
  }
}

export const garminApi = new GarminApi();
