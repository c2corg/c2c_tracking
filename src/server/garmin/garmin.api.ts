import { createHash, createHmac, randomBytes } from 'node:crypto';

import { z } from 'zod';

import config from '../../config.ts';
import { handleExternalApiError } from '../../helpers/error.ts';
import { http } from '../../helpers/http.ts';
import { nowSeconds } from '../../helpers/time.ts';

// OAuth 2 token response. Lifetimes are in seconds.
export const GarminAuth = z.object({
  access_token: z.string().min(10).max(5000),
  refresh_token: z.string().min(10).max(5000),
  expires_in: z.number().int().positive(),
  refresh_token_expires_in: z.number().int().positive().optional(),
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
  startTimeOffsetInSeconds: z.number().int(),
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

export class GarminApi {
  // OAuth 2 (PKCE): user consent page and token endpoint
  private readonly authorizeUrl = 'https://connect.garmin.com/oauth2Confirm';
  private readonly tokenUrl = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
  private readonly apiUrl = 'https://apis.garmin.com/';
  readonly #clientId: string;
  // OAuth 2 client secret, also the OAuth 1 consumer secret that signs the legacy user token exchange
  // (see scripts/migrate-garmin-oauth2.ts): the Garmin portal has a single secret per application
  readonly #clientSecret: string;
  readonly #redirectUri: string;

  constructor() {
    this.#clientId = config.get('trackers.garmin.consumerKey');
    this.#clientSecret = config.get('trackers.garmin.consumerSecret');
    this.#redirectUri = config.get('c2c.frontend.baseUrl') + config.get('trackers.garmin.redirectPath');
  }

  /** PKCE: random code verifier (RFC 7636, 43 chars) and its S256 challenge */
  public generatePkce(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  public generateState(): string {
    return randomBytes(16).toString('hex');
  }

  public getAuthorizationUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: this.#clientId,
      response_type: 'code',
      redirect_uri: this.#redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${this.authorizeUrl}?${params.toString()}`;
  }

  public async exchangeCode(code: string, codeVerifier: string, state: string): Promise<GarminAuth> {
    try {
      return await this.requestToken({
        grant_type: 'authorization_code',
        client_id: this.#clientId,
        client_secret: this.#clientSecret,
        code,
        code_verifier: codeVerifier,
        redirect_uri: this.#redirectUri,
        state,
      });
    } catch (error: unknown) {
      throw handleExternalApiError('garmin', 'Error on Garmin token exchange request', error);
    }
  }

  public async refreshAuth(refreshToken: string): Promise<GarminAuth> {
    try {
      return await this.requestToken({
        grant_type: 'refresh_token',
        client_id: this.#clientId,
        client_secret: this.#clientSecret,
        refresh_token: refreshToken,
      });
    } catch (error: unknown) {
      throw handleExternalApiError('garmin', 'Error on Garmin refresh token request', error);
    }
  }

  private async requestToken(params: Record<string, string>): Promise<GarminAuth> {
    const response = await http.post<unknown>(this.tokenUrl, new URLSearchParams(params), {
      headers: { Accept: 'application/json' },
    });
    return GarminAuth.parse(response.data);
  }

  /** Garmin API user id: stable across tokens, and the only user identifier sent in the webhooks with OAuth 2 */
  public async getUserId(accessToken: string): Promise<string> {
    try {
      const response = await http.get<unknown>(`${this.apiUrl}wellness-api/rest/user/id`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      });
      return z.object({ userId: z.string().min(1) }).parse(response.data).userId;
    } catch (error: unknown) {
      throw handleExternalApiError('garmin', 'Unable to retrieve Garmin user id', error);
    }
  }

  public async backfillActivities(startInSeconds: number, endInSeconds: number, accessToken: string): Promise<void> {
    try {
      await http.get(`${this.apiUrl}wellness-api/rest/backfill/activityDetails`, {
        params: { summaryStartTimeInSeconds: startInSeconds, summaryEndTimeInSeconds: endInSeconds },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error: unknown) {
      throw handleExternalApiError('garmin', 'Unable to request Garmin summary activity backfill', error);
    }
  }

  public async deauthorize(accessToken: string): Promise<void> {
    try {
      await http.delete<void>(`${this.apiUrl}wellness-api/rest/user/registration`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error: unknown) {
      throw handleExternalApiError('garmin', 'Error on Garmin deauthorize request', error);
    }
  }

  /*
   * Legacy OAuth 1 -> OAuth 2 migration. Only usable once Garmin has enabled OAuth 2 for the app.
   * Both calls are signed with the user's OAuth 1 token. The OAuth 1 token remains valid 30 days after the exchange.
   */
  public async getLegacyUserId(token: string, tokenSecret: string): Promise<string> {
    try {
      const url = `${this.apiUrl}wellness-api/rest/user/id`;
      const response = await http.get<unknown>(url, {
        headers: { Authorization: this.generateLegacyAuth('GET', url, token, tokenSecret), Accept: 'application/json' },
      });
      return z.object({ userId: z.string().min(1) }).parse(response.data).userId;
    } catch (error: unknown) {
      throw handleExternalApiError('garmin', 'Unable to retrieve Garmin user id (OAuth 1)', error);
    }
  }

  public async exchangeLegacyToken(token: string, tokenSecret: string): Promise<GarminAuth> {
    try {
      const url = `${this.apiUrl}partner-gateway/rest/user/token-exchange`;
      const response = await http.post<unknown>(url, null, {
        headers: {
          Authorization: this.generateLegacyAuth('POST', url, token, tokenSecret),
          Accept: 'application/json',
        },
      });
      return GarminAuth.parse(response.data);
    } catch (error: unknown) {
      throw handleExternalApiError('garmin', 'Unable to exchange Garmin OAuth 1 token', error);
    }
  }

  private generateLegacyAuth(method: 'GET' | 'POST', url: string, token: string, tokenSecret: string): string {
    const timestamp = nowSeconds();
    const nonce = randomBytes(16).toString('hex');
    const normalizedParameters = `oauth_consumer_key=${this.#clientId}&oauth_nonce=${nonce}&oauth_signature_method=HMAC-SHA1&oauth_timestamp=${timestamp}&oauth_token=${token}&oauth_version=1.0`;
    const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(normalizedParameters)}`;
    const signature = encodeURIComponent(
      createHmac('sha1', `${this.#clientSecret}&${tokenSecret}`).update(signatureBaseString).digest('base64'),
    );
    return `OAuth oauth_nonce="${nonce}", oauth_signature="${signature}", oauth_token="${token}", oauth_consumer_key="${this.#clientId}", oauth_timestamp="${timestamp}", oauth_signature_method="HMAC-SHA1", oauth_version="1.0"`;
  }
}

export const garminApi = new GarminApi();
