import axios from 'axios';

import log from '../../../../src/helpers/logger';
import { GarminApi } from '../../../../src/server/garmin/garmin.api';

jest.mock('axios');

describe('Garmin API', () => {
  beforeEach(() => {
    jest.spyOn(log, 'info').mockImplementation(() => Promise.resolve());
    jest.spyOn(log, 'warn').mockImplementation(() => Promise.resolve());
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

  describe('getActivitiesForDay', () => {
    it('retrieves activities from given day', async () => {
      jest.mocked(axios).get.mockResolvedValueOnce({ data: [] });

      const api = new GarminApi();
      const result = await api.getActivitiesForDay(new Date('1970-01-01T00:00:01Z'), 'token', 'tokenSecret');

      expect(result).toEqual([]);
      expect(jest.mocked(axios).get).toBeCalledTimes(1);
      expect(jest.mocked(axios).get).toBeCalledWith(
        `https://apis.garmin.com/wellness-api/rest/activityDetails?uploadStartTimeInSeconds=0&uploadEndTimeInSeconds=86399`,
        expect.anything(),
      );
    });
  });

  describe('deauthorize', () => {
    it('deauthorizes user', async () => {
      jest.mocked(axios).delete.mockResolvedValueOnce(undefined);

      const api = new GarminApi();
      await api.deauthorize('tokn', 'toknSecret');

      expect(jest.mocked(axios).delete).toBeCalledTimes(1);
      expect(jest.mocked(axios).delete).toBeCalledWith(
        `https://apis.garmin.com/wellness-api/rest/user/registration`,
        expect.anything(),
      );
    });
  });
});
