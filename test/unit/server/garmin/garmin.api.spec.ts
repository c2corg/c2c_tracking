import axios from 'axios';

import log from '../../../../src/helpers/logger.js';
import { GarminApi } from '../../../../src/server/garmin/garmin.api';

jest.mock('axios');

describe('Garmin API', () => {
  beforeEach(() => {
    jest.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    jest.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  describe('requestUnauthorizedRequestToken', () => {
    it(`throws if token isn't retrieved`, async () => {
      jest.mocked(axios).post.mockResolvedValueOnce({ data: 'whatever' });

      const api = new GarminApi();
      await expect(api.requestUnauthorizedRequestToken()).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Unable to acquire Garmin unauthorized request token"`,
      );
    });

    it('returns unauthorized request token info', async () => {
      jest.mocked(axios).post.mockResolvedValueOnce({ data: 'oauth_token=a-token&oauth_token_secret=tokensecret' });

      const api = new GarminApi();
      const { token, tokenSecret } = await api.requestUnauthorizedRequestToken();

      expect(token).toBe('a-token');
      expect(tokenSecret).toBe('tokensecret');
    });
  });

  describe('exchangeToken', () => {
    it(`throws if token isn't retrieved`, async () => {
      jest.mocked(axios).post.mockResolvedValueOnce({ data: 'whatever' });

      const api = new GarminApi();
      await expect(api.exchangeToken('token', 'tokenSecret', 'verifier')).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Unable to acquire Garmin access request token"`,
      );
    });

    it('returns unauthorized request token info', async () => {
      jest.mocked(axios).post.mockResolvedValueOnce({ data: 'oauth_token=a-token&oauth_token_secret=tokensecret' });

      const api = new GarminApi();
      const { token, tokenSecret } = await api.exchangeToken('token', 'tokenSecret', 'verifier');

      expect(token).toBe('a-token');
      expect(tokenSecret).toBe('tokensecret');
    });
  });

  describe('backfillActivities', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2020-03-31T21:12:01Z') });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('requests activities backfill', async () => {
      jest.mocked(axios).get.mockResolvedValueOnce({ data: [] });

      const api = new GarminApi();
      await api.backfillActivities(30, 'token', 'tokenSecret');

      expect(jest.mocked(axios).get).toHaveBeenCalledTimes(1);
      expect(jest.mocked(axios).get).toHaveBeenCalledWith(
        `https://apis.garmin.com/wellness-api/rest/backfill/activityDetails?summaryStartTimeInSeconds=1583020800&summaryEndTimeInSeconds=1585699199`,
        expect.anything(),
      );
    });
  });

  describe('deauthorize', () => {
    it('deauthorizes user', async () => {
      jest.mocked(axios).delete.mockResolvedValueOnce(undefined);

      const api = new GarminApi();
      await api.deauthorize('tokn', 'toknSecret');

      expect(jest.mocked(axios).delete).toHaveBeenCalledTimes(1);
      expect(jest.mocked(axios).delete).toHaveBeenCalledWith(
        `https://apis.garmin.com/wellness-api/rest/user/registration`,
        expect.anything(),
      );
    });
  });
});
