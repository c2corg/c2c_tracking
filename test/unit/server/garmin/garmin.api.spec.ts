import { beforeEach, describe, expect, it, vi } from 'vitest';

import { http } from '../../../../src/helpers/http.ts';
import log from '../../../../src/helpers/logger.ts';
import { GarminApi } from '../../../../src/server/garmin/garmin.api.ts';
import { respond } from '../../../utils.ts';

// the HTTP calls are mocked, not the errors
vi.mock('../../../../src/helpers/http.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  http: { get: vi.fn(), post: vi.fn(), postForm: vi.fn(), delete: vi.fn() },
}));

describe('Garmin API', () => {
  beforeEach(() => {
    vi.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    vi.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  describe('requestUnauthorizedRequestToken', () => {
    it(`throws if token isn't retrieved`, async () => {
      vi.mocked(http).post.mockResolvedValueOnce(respond('whatever'));

      const api = new GarminApi();
      await expect(api.requestUnauthorizedRequestToken()).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Unable to acquire Garmin unauthorized request token]`,
      );
    });

    it('returns unauthorized request token info', async () => {
      vi.mocked(http).post.mockResolvedValueOnce(respond('oauth_token=a-token&oauth_token_secret=tokensecret'));

      const api = new GarminApi();
      const { token, tokenSecret } = await api.requestUnauthorizedRequestToken();

      expect(token).toBe('a-token');
      expect(tokenSecret).toBe('tokensecret');
    });
  });

  describe('exchangeToken', () => {
    it(`throws if token isn't retrieved`, async () => {
      vi.mocked(http).post.mockResolvedValueOnce(respond('whatever'));

      const api = new GarminApi();
      await expect(api.exchangeToken('token', 'tokenSecret', 'verifier')).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Unable to acquire Garmin access request token]`,
      );
    });

    it('returns unauthorized request token info', async () => {
      vi.mocked(http).post.mockResolvedValueOnce(respond('oauth_token=a-token&oauth_token_secret=tokensecret'));

      const api = new GarminApi();
      const { token, tokenSecret } = await api.exchangeToken('token', 'tokenSecret', 'verifier');

      expect(token).toBe('a-token');
      expect(tokenSecret).toBe('tokensecret');
    });
  });

  describe('backfillActivities', () => {
    it('requests activities backfill', async () => {
      vi.mocked(http).get.mockResolvedValueOnce(respond([]));

      const api = new GarminApi();
      await api.backfillActivities(1583020800, 1585699199, 'token', 'tokenSecret');

      expect(vi.mocked(http).get).toHaveBeenCalledTimes(1);
      expect(vi.mocked(http).get).toHaveBeenCalledWith(
        `https://apis.garmin.com/wellness-api/rest/backfill/activityDetails?summaryStartTimeInSeconds=1583020800&summaryEndTimeInSeconds=1585699199`,
        expect.anything(),
      );
    });
  });

  describe('deauthorize', () => {
    it('deauthorizes user', async () => {
      vi.mocked(http).delete.mockResolvedValueOnce(respond());

      const api = new GarminApi();
      await api.deauthorize('tokn', 'toknSecret');

      expect(vi.mocked(http).delete).toHaveBeenCalledTimes(1);
      expect(vi.mocked(http).delete).toHaveBeenCalledWith(
        `https://apis.garmin.com/wellness-api/rest/user/registration`,
        expect.anything(),
      );
    });
  });
});
