import { createHmac, randomBytes } from 'crypto';

import axios from 'axios';
import dayjs from 'dayjs';
import { z } from 'zod';

import config from '../../config';
import { AppError } from '../../errors';

export const GarminAuth = z.object({
  token: z.string().min(10).max(5000),
  tokenSecret: z.string().min(10).max(5000),
});
export type GarminAuth = z.infer<typeof GarminAuth>;

export const GarminActivityType = z.enum([
  'RUNNING',
  'INDOOR RUNNING',
  'OBSTACLE RUNNING',
  'STREET RUNNING',
  'TRACK RUNNING',
  'TRAIL RUNNING',
  'TREADMILL RUNNING',
  'ULTRA RUNNING',
  'VIRTUAL RUNNING',
  'CYCLING',
  'BMX',
  'CYCLOCROSS',
  'DOWNHILL BIKING',
  'GRAVEL/UNPAVED CYCLING',
  'INDOOR CYCLING',
  'MOUNTAIN BIKING',
  'RECUMBENT CYCLING',
  'ROAD CYCLING',
  'TRACK CYCLING',
  'VIRTUAL CYCLING',
  'GYM & FITNESS EQUIPMENT',
  'BOULDERING',
  'ELLIPTICAL',
  'CARDIO',
  'INDOOR CLIMBING',
  'INDOOR ROWING',
  'PILATES',
  'STAIR STEPPER',
  'STRENGTH TRAINING',
  'YOGA',
  'HIKING',
  'SWIMMING',
  'POOL SWIMMING',
  'OPEN WATER SWIMMING',
  'WALKING/INDOOR WALKING',
  'CASUAL WALKING',
  'SPEED WALKING',
  'TRANSITION',
  'BIKE TO RUN TRANSITION',
  'RUN TO BIKE TRANSITION',
  'SWIM TO BIKE TRANSITION',
  'MOTORCYCLING',
  'ATV',
  'MOTOCROSS',
  'OTHER',
  'AUTO RACING',
  'BOATING',
  'BREATHWORK',
  'DRIVING',
  'E_SPORT',
  'FLOOR CLIMBING',
  'FLYING',
  'GOLF',
  'HANG GLIDING',
  'HORSEBACK RIDING',
  'HUNTING/FISHING',
  'HUNTING',
  'FISHING',
  'INLINE SKATING',
  'MOUNTAINEERING',
  'OFFSHORE GRINDING',
  'ONSHORE GRINDING',
  'PADDLING',
  'RC/DRONE',
  'ROCK CLIMBING',
  'ROWING',
  'SAILING',
  'SKY DIVING',
  'STAND UP PADDLEBOARDING',
  'STOPWATCH',
  'SURFING',
  'TENNIS',
  'WAKEBOARDING',
  'WHITEWATER KAYAKING/RAFTING',
  'WIND/KITE SURFING',
  'WINGSUIT FLYING',
  'DIVING',
  'APNEA',
  'APNEA HUNT',
  'CCR DIVE',
  'GAUGE DIVE',
  'MULTI-GAS DIVE',
  'SINGLE-GAS DIVE',
  'WINTER SPORTS',
  'BACKCOUNTRY SKIING/SNOWBOARDING',
  'CROSS COUNTRY CLASSIC SKIING',
  'RESORT SKIING/SNOWBOARDING',
  'CROSS COUNTRY SKATE SKIING',
  'SKATING',
  'SNOWSHOEING',
  'SNOWMOBILING',
]);
export type GarminActivityType = z.infer<typeof GarminActivityType>;

export const GarminActivitySummary = z.object({
  activityType: GarminActivityType,
  startTimeInSeconds: z.number().int().positive(),
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
  samples: z.array(GarminSample),
});
export type GarminActivity = z.infer<typeof GarminActivity>;

export class GarminApi {
  private readonly oauthUrl = 'https://connectapi.garmin.com/oauth-service/';
  private readonly apiUrl = 'https://apis.garmin.com/';
  readonly #consumerKey: string;
  readonly #consumerSecret: string;

  constructor() {
    this.#consumerKey = config.get('trackers.garmin.consumerKey');
    this.#consumerSecret = config.get('trackers.garmin.consumerSecret');
  }

  async requestUnauthorizedRequestToken(): Promise<GarminAuth> {
    const timestamp = dayjs().unix();
    const nonce = randomBytes(16).toString('hex');
    const signature = encodeURIComponent(this.generateUnauthorizedRequestTokenSignature(timestamp, nonce));
    const authorization = `OAuth oauth_nonce="${nonce}", oauth_signature="${signature}", oauth_consumer_key="${
      this.#consumerKey
    }", oauth_timestamp="${timestamp}", oauth_signature_method="HMAC-SHA1", oauth_version="1.0"`;
    const response = await axios.post<string>(`${this.oauthUrl}oauth/request_token`, null, {
      headers: {
        Authorization: authorization,
      },
      responseType: 'text',
    });
    const [_oauth_token, token, _oauth_token_secret, tokenSecret] = response.data
      .split('&')
      .flatMap((substring) => substring.split('='));
    if (!token || !tokenSecret) {
      throw new AppError(502, 'Unable to acquire Garmin unauthorized request token');
    }
    return { token: token!, tokenSecret: tokenSecret! }; // eslint-disable-line @typescript-eslint/no-non-null-assertion
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

  async exchangeToken(requestToken: string, requestTokenSecret: string, verifier: string): Promise<GarminAuth> {
    const timestamp = dayjs().unix();
    const nonce = randomBytes(16).toString('hex');
    const signature = encodeURIComponent(
      this.generateExchangeTokenSignature(timestamp, nonce, requestToken, requestTokenSecret, verifier),
    );
    const response = await axios.post<string>(`${this.oauthUrl}oauth/access_token`, null, {
      headers: {
        Authorization: `OAuth oauth_verifier="${verifier}", oauth_version="1.0", oauth_consumer_key="${
          this.#consumerKey
        }", oauth_token="${requestToken}", oauth_timestamp="${timestamp}", oauth_nonce="${nonce}", oauth_signature_method="HMAC-SHA1", oauth_signature="${signature}"`,
      },
      responseType: 'text',
    });
    const [_oauth_token, token, _oauth_token_secret, tokenSecret] = response.data
      .split('&')
      .flatMap((substring) => substring.split('='));
    if (!requestToken || !tokenSecret) {
      throw new AppError(502, 'Unable to acquire Garmin access request token');
    }
    return { token: token!, tokenSecret: tokenSecret! }; // eslint-disable-line @typescript-eslint/no-non-null-assertion
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

  async getActivitiesForDay(date: Date, token: string, tokenSecret: string): Promise<GarminActivity[]> {
    const url = `${this.apiUrl}wellness-api/rest/activityDetails`;
    const end = dayjs(date).endOf('day').unix();
    const start = dayjs(date).startOf('day').unix();
    const response = await axios.get<GarminActivity[]>(
      `${url}?uploadStartTimeInSeconds=${start}&uploadEndTimeInSeconds=${end}`,
      {
        headers: { Authorization: this.generateApiRequestAuth('GET', url, token, tokenSecret, start, end) },
      },
    );
    return response.data;
  }

  async deauthorize(token: string, tokenSecret: string): Promise<void> {
    const url = `${this.apiUrl}wellness-api/rest/user/registration`;
    await axios.delete<void>(`${url}`, {
      headers: {
        Authorization: this.generateApiRequestAuth('DELETE', url, token, tokenSecret),
      },
    });
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
    if (start && end) {
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
