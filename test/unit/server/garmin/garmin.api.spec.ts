import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import log from '../../../../src/helpers/logger';
import { GarminApi } from '../../../../src/server/garmin/garmin.api';

vi.mock('axios');

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
      vi.mocked(axios).post.mockResolvedValueOnce({ data: 'whatever' });

      const api = new GarminApi();
      await expect(api.requestUnauthorizedRequestToken()).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Unable to acquire Garmin unauthorized request token]`,
      );
    });

    it('returns unauthorized request token info', async () => {
      vi.mocked(axios).post.mockResolvedValueOnce({ data: 'oauth_token=a-token&oauth_token_secret=tokensecret' });

      const api = new GarminApi();
      const { token, tokenSecret } = await api.requestUnauthorizedRequestToken();

      expect(token).toBe('a-token');
      expect(tokenSecret).toBe('tokensecret');
    });
  });

  describe('exchangeToken', () => {
    it(`throws if token isn't retrieved`, async () => {
      vi.mocked(axios).post.mockResolvedValueOnce({ data: 'whatever' });

      const api = new GarminApi();
      await expect(api.exchangeToken('token', 'tokenSecret', 'verifier')).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Unable to acquire Garmin access request token]`,
      );
    });

    it('returns unauthorized request token info', async () => {
      vi.mocked(axios).post.mockResolvedValueOnce({ data: 'oauth_token=a-token&oauth_token_secret=tokensecret' });

      const api = new GarminApi();
      const { token, tokenSecret } = await api.exchangeToken('token', 'tokenSecret', 'verifier');

      expect(token).toBe('a-token');
      expect(tokenSecret).toBe('tokensecret');
    });
  });

  describe('backfillActivities', () => {
    it('requests activities backfill', async () => {
      vi.mocked(axios).get.mockResolvedValueOnce({ data: [] });

      const api = new GarminApi();
      await api.backfillActivities(1583020800, 1585699199, 'token', 'tokenSecret');

      expect(vi.mocked(axios).get).toHaveBeenCalledTimes(1);
      expect(vi.mocked(axios).get).toHaveBeenCalledWith(
        `https://apis.garmin.com/wellness-api/rest/backfill/activityDetails?summaryStartTimeInSeconds=1583020800&summaryEndTimeInSeconds=1585699199`,
        expect.anything(),
      );
    });
  });

  describe('deauthorize', () => {
    it('deauthorizes user', async () => {
      vi.mocked(axios).delete.mockResolvedValueOnce(undefined);

      const api = new GarminApi();
      await api.deauthorize('tokn', 'toknSecret');

      expect(vi.mocked(axios).delete).toHaveBeenCalledTimes(1);
      expect(vi.mocked(axios).delete).toHaveBeenCalledWith(
        `https://apis.garmin.com/wellness-api/rest/user/registration`,
        expect.anything(),
      );
    });
  });
});
