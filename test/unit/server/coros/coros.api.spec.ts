import axios from 'axios';

import log from '../../../../src/helpers/logger';
import { CorosApi, CorosAuth, WorkoutRecord, WorkoutRecords } from '../../../../src/server/coros/coros.api';

jest.mock('axios');

describe('Coros API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    jest.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  describe('exchangeToken', () => {
    it('throws if request fails', async () => {
      jest.mocked(axios).post.mockRejectedValueOnce(undefined);

      const api = new CorosApi();

      await expect(api.exchangeToken('code')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Coros token exchange request]`,
      );
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('calls coros API', async () => {
      const auth: CorosAuth = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        openId: '1',
      };
      jest.mocked(axios).post.mockResolvedValueOnce({ data: auth });

      const api = new CorosApi();
      const result = await api.exchangeToken('code');

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        'https://open.coros.com/oauth2/accesstoken',
        {
          code: 'code',
          grant_type: 'authorization_code',
          redirect_uri: 'http://localhost:8080/trackers/coros/exchange-token',
          client_id: 'f263ed9257c74e808befaf548a27852c',
          client_secret: '902d20cc-c2a8-4536-89a9-41e0f7626977',
        },
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      expect(result).toMatchInlineSnapshot(`
        {
          "access_token": "access_token",
          "openId": "1",
          "refresh_token": "refresh_token",
        }
      `);
    });
  });

  describe('deauthorize', () => {
    it('throws if request fails', async () => {
      jest.mocked(axios).post.mockRejectedValueOnce(undefined);

      const api = new CorosApi();

      await expect(api.deauthorize('token')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Coros deauthorize request]`,
      );
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('calls coros API', async () => {
      jest.mocked(axios).post.mockResolvedValueOnce(undefined);

      const api = new CorosApi();
      await api.deauthorize('token');

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        'https://open.coros.com/oauth2/deauthorize',
        { token: 'token' },
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
    });
  });

  describe('refreshAuth', () => {
    it('throws if request fails', async () => {
      jest.mocked(axios).post.mockRejectedValueOnce(undefined);

      const api = new CorosApi();

      await expect(api.refreshAuth('token')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Coros refresh token request]`,
      );
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('calls coros API', async () => {
      jest.mocked(axios).post.mockResolvedValueOnce(undefined);

      const api = new CorosApi();
      await api.refreshAuth('token');

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        'https://open.coros.com/oauth2/refresh-token',
        {
          grant_type: 'refresh_token',
          refresh_token: 'token',
          client_id: 'f263ed9257c74e808befaf548a27852c',
          client_secret: '902d20cc-c2a8-4536-89a9-41e0f7626977',
        },
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
    });
  });

  describe('getWorkouts', () => {
    it('throws if request fails', async () => {
      jest.mocked(axios).get.mockRejectedValueOnce(undefined);

      const api = new CorosApi();

      await expect(api.getWorkouts('token', '1', 20230201, 20230228)).rejects.toMatchInlineSnapshot(
        `[Error: Error on Coros getWorkouts request]`,
      );
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('calls coros API', async () => {
      const workouts: WorkoutRecords = {
        data: [
          {
            labelId: '1234',
            mode: 8,
            subMode: 1,
            startTime: 1516096869,
            endTime: 1516097362,
            startTimezone: 32,
            endTimezone: 32,
            fitUrl: 'https://oss.coros.com/fit/407419767966679040/418173292602490880.fit',
          },
        ],
        message: 'OK',
        result: '0000',
      };
      jest.mocked(axios).get.mockResolvedValueOnce({ data: workouts });

      const api = new CorosApi();
      const result = await api.getWorkouts('token', '1', 20230201, 20230228);

      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledWith('https://open.coros.com/v2/coros/sport/list', {
        params: { token: 'token', openId: '1', startDate: 20230201, endDate: 20230228 },
      });
      expect(result).toMatchInlineSnapshot(`
        {
          "data": [
            {
              "endTime": 1516097362,
              "endTimezone": 32,
              "fitUrl": "https://oss.coros.com/fit/407419767966679040/418173292602490880.fit",
              "labelId": "1234",
              "mode": 8,
              "startTime": 1516096869,
              "startTimezone": 32,
              "subMode": 1,
            },
          ],
          "message": "OK",
          "result": "0000",
        }
      `);
    });
  });

  describe('getWorkoutDetails', () => {
    it('throws if request fails', async () => {
      jest.mocked(axios).get.mockRejectedValueOnce(undefined);

      const api = new CorosApi();

      await expect(api.getWorkoutDetails('token', 'workoutId', 8, 1, 'openId')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Coros getWorkoutDetails request]`,
      );
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('calls coros API', async () => {
      const workout: WorkoutRecord = {
        data: {
          labelId: '1234',
          mode: 8,
          subMode: 1,
          startTime: 1516096869,
          endTime: 1516097362,
          startTimezone: 32,
          endTimezone: 32,
          fitUrl: 'https://oss.coros.com/fit/407419767966679040/418173292602490880.fit',
        },
        message: 'OK',
        result: '0000',
      };
      jest.mocked(axios).get.mockResolvedValueOnce({ data: workout });

      const api = new CorosApi();
      const result = await api.getWorkoutDetails('token', 'workoutId', 8, 1, 'openId');

      expect(result).toMatchInlineSnapshot(`
        {
          "data": {
            "endTime": 1516097362,
            "endTimezone": 32,
            "fitUrl": "https://oss.coros.com/fit/407419767966679040/418173292602490880.fit",
            "labelId": "1234",
            "mode": 8,
            "startTime": 1516096869,
            "startTimezone": 32,
            "subMode": 1,
          },
          "message": "OK",
          "result": "0000",
        }
      `);
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFIT', () => {
    it('throws if request fails', async () => {
      jest.mocked(axios).get.mockRejectedValueOnce(undefined);

      const api = new CorosApi();

      await expect(api.getFIT('url')).rejects.toMatchInlineSnapshot(`[Error: Error on Coros getFIT request]`);
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('returns FIT', async () => {
      jest.mocked(axios).get.mockResolvedValueOnce({ data: new ArrayBuffer(1) });

      const api = new CorosApi();
      const result = await api.getFIT('url');

      expect(result).toMatchInlineSnapshot(`ArrayBuffer []`);
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSport', () => {
    it('computes sport based on mode and submode', () => {
      const api = new CorosApi();
      expect(api.getSport(8, 1)).toEqual('Outdoor Run');
      expect(api.getSport(8, 3)).toEqual('Unknown');
      expect(api.getSport(29, 1)).toEqual('Ski Touring');
    });
  });
});
