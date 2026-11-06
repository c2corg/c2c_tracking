import { createHash } from 'node:crypto';

import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import log from '../../../../src/helpers/logger.ts';
import { GarminApi } from '../../../../src/server/garmin/garmin.api.ts';

vi.mock('axios');

const tokenResponse = {
  access_token: 'an-access-token',
  refresh_token: 'a-refresh-token',
  expires_in: 86400,
  refresh_token_expires_in: 7776000,
  token_type: 'bearer',
};

describe('Garmin API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    vi.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  describe('generatePkce', () => {
    it('returns a verifier and its S256 challenge', () => {
      const { codeVerifier, codeChallenge } = new GarminApi().generatePkce();

      expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(codeChallenge).toBe(createHash('sha256').update(codeVerifier).digest('base64url'));
    });

    it('returns a different verifier each time', () => {
      const api = new GarminApi();
      expect(api.generatePkce().codeVerifier).not.toBe(api.generatePkce().codeVerifier);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('builds the consent page URL', () => {
      const url = new URL(new GarminApi().getAuthorizationUrl('a-state', 'a-challenge'));

      expect(url.origin + url.pathname).toBe('https://connect.garmin.com/oauth2Confirm');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('client_id')).toBeTruthy();
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:8080/trackers/garmin/exchange-token');
      expect(url.searchParams.get('state')).toBe('a-state');
      expect(url.searchParams.get('code_challenge')).toBe('a-challenge');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    });
  });

  describe('exchangeCode', () => {
    it('throws if the response is not a valid token', async () => {
      vi.mocked(axios).post.mockResolvedValueOnce({ data: { whatever: true } });

      await expect(new GarminApi().exchangeCode('code', 'verifier', 'state')).rejects.toThrow();
    });

    it('exchanges the code for tokens', async () => {
      vi.mocked(axios).post.mockResolvedValueOnce({ data: tokenResponse });

      const auth = await new GarminApi().exchangeCode('code', 'verifier', 'state');

      expect(auth).toMatchObject({ access_token: 'an-access-token', refresh_token: 'a-refresh-token' });
      expect(vi.mocked(axios).post).toHaveBeenCalledTimes(1);
      const [url, body] = vi.mocked(axios).post.mock.calls[0] as [string, URLSearchParams];
      expect(url).toBe('https://diauth.garmin.com/di-oauth2-service/oauth/token');
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('code')).toBe('code');
      expect(body.get('code_verifier')).toBe('verifier');
      expect(body.get('state')).toBe('state');
      expect(body.get('client_secret')).toBe('secret');
    });
  });

  describe('refreshAuth', () => {
    it('refreshes tokens', async () => {
      vi.mocked(axios).post.mockResolvedValueOnce({ data: tokenResponse });

      const auth = await new GarminApi().refreshAuth('a-refresh-token');

      expect(auth.access_token).toBe('an-access-token');
      const [url, body] = vi.mocked(axios).post.mock.calls[0] as [string, URLSearchParams];
      expect(url).toBe('https://diauth.garmin.com/di-oauth2-service/oauth/token');
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('a-refresh-token');
    });
  });

  describe('getUserId', () => {
    it('returns the Garmin user id', async () => {
      vi.mocked(axios).get.mockResolvedValueOnce({ data: { userId: 'garmin-user-1' } });

      expect(await new GarminApi().getUserId('an-access-token')).toBe('garmin-user-1');
      expect(vi.mocked(axios).get).toHaveBeenCalledWith(
        'https://apis.garmin.com/wellness-api/rest/user/id',
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          headers: expect.objectContaining({ Authorization: 'Bearer an-access-token' }),
        }),
      );
    });

    it('throws if there is no user id', async () => {
      vi.mocked(axios).get.mockResolvedValueOnce({ data: {} });

      await expect(new GarminApi().getUserId('an-access-token')).rejects.toThrow();
    });
  });

  describe('backfillActivities', () => {
    it('requests activities backfill', async () => {
      vi.mocked(axios).get.mockResolvedValueOnce({ data: [] });

      await new GarminApi().backfillActivities(1583020800, 1585699199, 'an-access-token');

      expect(vi.mocked(axios).get).toHaveBeenCalledTimes(1);
      expect(vi.mocked(axios).get).toHaveBeenCalledWith(
        `https://apis.garmin.com/wellness-api/rest/backfill/activityDetails`,
        {
          params: { summaryStartTimeInSeconds: 1583020800, summaryEndTimeInSeconds: 1585699199 },
          headers: { Authorization: 'Bearer an-access-token' },
        },
      );
    });
  });

  describe('deauthorize', () => {
    it('deauthorizes user', async () => {
      vi.mocked(axios).delete.mockResolvedValueOnce(undefined);

      await new GarminApi().deauthorize('an-access-token');

      expect(vi.mocked(axios).delete).toHaveBeenCalledTimes(1);
      expect(vi.mocked(axios).delete).toHaveBeenCalledWith(
        `https://apis.garmin.com/wellness-api/rest/user/registration`,
        { headers: { Authorization: 'Bearer an-access-token' } },
      );
    });
  });

  describe('legacy OAuth 1 migration', () => {
    it('reads the user id with an OAuth 1 signed request', async () => {
      vi.mocked(axios).get.mockResolvedValueOnce({ data: { userId: 'garmin-user-1' } });

      expect(await new GarminApi().getLegacyUserId('token-123456', 'secret-123456')).toBe('garmin-user-1');

      const [, options] = vi.mocked(axios).get.mock.calls[0] as [string, { headers: { Authorization: string } }];
      expect(options.headers.Authorization).toMatch(/^OAuth /);
      expect(options.headers.Authorization).toContain('oauth_token="token-123456"');
      expect(options.headers.Authorization).toContain('oauth_signature="');
    });

    it('exchanges the OAuth 1 token for OAuth 2 tokens', async () => {
      vi.mocked(axios).post.mockResolvedValueOnce({ data: tokenResponse });

      const auth = await new GarminApi().exchangeLegacyToken('token-123456', 'secret-123456');

      expect(auth.refresh_token).toBe('a-refresh-token');
      const [url, , options] = vi.mocked(axios).post.mock.calls[0] as [
        string,
        unknown,
        { headers: { Authorization: string } },
      ];
      expect(url).toBe('https://apis.garmin.com/partner-gateway/rest/user/token-exchange');
      expect(options.headers.Authorization).toMatch(/^OAuth /);
      expect(options.headers.Authorization).toContain('oauth_token="token-123456"');
      expect(options.headers.Authorization).toContain('oauth_signature="');
    });
  });
});
