import axios from 'axios';

import log from '../../../../src/helpers/logger';
import { SuuntoApi } from '../../../../src/server/suunto/suunto.api';

jest.mock('axios');

describe('Suunto API', () => {
  beforeEach(() => {
    jest.spyOn(log, 'info').mockImplementation(() => Promise.resolve());
    jest.spyOn(log, 'warn').mockImplementation(() => Promise.resolve());
    jest.clearAllMocks();
  });

  describe('exchangeToken', () => {
    it('throws if request failed', async () => {
      jest.mocked(axios).post.mockRejectedValueOnce(undefined);

      const api = new SuuntoApi();

      await expect(api.exchangeToken('code')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto token exchange request]`,
      );
      expect(axios.post).toBeCalledTimes(1);
    });

    it('throws if request response is invalid', async () => {
      jest.mocked(axios).post.mockResolvedValueOnce({});

      const api = new SuuntoApi();

      await expect(api.exchangeToken('code')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto token exchange request]`,
      );
      expect(axios.post).toBeCalledTimes(1);
    });

    it('returns auth', async () => {
      jest.mocked(axios).post.mockResolvedValueOnce({
        data: {
          access_token: 'access_token',
          token_type: 'bearer',
          refresh_token: 'refresh_token',
          expires_in: 1,
          user: 'user',
        },
      });

      const api = new SuuntoApi();
      const result = await api.exchangeToken('code');

      expect(result).toMatchInlineSnapshot(`
        {
          "access_token": "access_token",
          "expires_in": 1,
          "refresh_token": "refresh_token",
          "token_type": "bearer",
          "user": "user",
        }
      `);
      expect(axios.post).toBeCalledTimes(1);
    });
  });

  describe('refreshAuth', () => {
    it('throws if request failed', async () => {
      jest.mocked(axios).post.mockRejectedValueOnce(undefined);

      const api = new SuuntoApi();

      await expect(api.refreshAuth('token')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto refresh token request]`,
      );
      expect(axios.post).toBeCalledTimes(1);
    });

    it('throws if request response is invalid', async () => {
      jest.mocked(axios).post.mockResolvedValueOnce({});

      const api = new SuuntoApi();

      await expect(api.refreshAuth('token')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto refresh token request]`,
      );
      expect(axios.post).toBeCalledTimes(1);
    });

    it('returns refresh auth', async () => {
      jest.mocked(axios).post.mockResolvedValueOnce({
        data: {
          access_token: 'access_token',
          token_type: 'bearer',
          refresh_token: 'refresh_token',
          expires_in: 1,
          user: 'user',
        },
      });

      const api = new SuuntoApi();
      const result = await api.refreshAuth('token');

      expect(result).toMatchInlineSnapshot(`
          {
            "access_token": "access_token",
            "expires_in": 1,
            "refresh_token": "refresh_token",
            "token_type": "bearer",
          }
        `);
      expect(axios.post).toBeCalledTimes(1);
    });
  });

  describe('getWorkouts', () => {
    it('throws if request failed', async () => {
      jest.mocked(axios).get.mockRejectedValueOnce(undefined);

      const api = new SuuntoApi();

      await expect(api.getWorkouts('token', 'subscription')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Strava getWorkouts request]`,
      );
      expect(axios.get).toBeCalledTimes(1);
    });

    it('throws if request response is invalid', async () => {
      jest.mocked(axios).get.mockResolvedValueOnce({});

      const api = new SuuntoApi();

      await expect(api.getWorkouts('token', 'subscription')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Strava getWorkouts request]`,
      );
      expect(axios.get).toBeCalledTimes(1);
    });

    it('returns workouts', async () => {
      jest.mocked(axios).get.mockResolvedValueOnce({
        data: {
          payload: [
            {
              workoutId: 1,
              workoutKey: '1',
              workoutName: 'name',
              activityId: 1,
              description: 'description',
              startTime: 1,
              totalTime: 1,
              totalAscent: 1.2,
              totalDistance: 1.2,
              timeOffsetInMinutes: 0,
            },
          ],
          metadata: {},
        },
      });

      const api = new SuuntoApi();
      const result = await api.getWorkouts('token', 'subscription');

      expect(result).toMatchInlineSnapshot(`
        {
          "metadata": {},
          "payload": [
            {
              "activityId": 1,
              "description": "description",
              "startTime": 1,
              "timeOffsetInMinutes": 0,
              "totalAscent": 1.2,
              "totalDistance": 1.2,
              "totalTime": 1,
              "workoutId": 1,
              "workoutKey": "1",
              "workoutName": "name",
            },
          ],
        }
      `);
      expect(axios.get).toBeCalledTimes(1);
    });
  });

  describe('getWorkoutDetails', () => {
    it('throws if request failed', async () => {
      jest.mocked(axios).get.mockRejectedValueOnce(undefined);

      const api = new SuuntoApi();

      await expect(api.getWorkoutDetails('1', 'token', 'subscription')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Strava getWorkoutDetails request]`,
      );
      expect(axios.get).toBeCalledTimes(1);
    });

    it('throws if request response is invalid', async () => {
      jest.mocked(axios).get.mockResolvedValueOnce({});

      const api = new SuuntoApi();

      await expect(api.getWorkoutDetails('1', 'token', 'subscription')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Strava getWorkoutDetails request]`,
      );
      expect(axios.get).toBeCalledTimes(1);
    });

    it('returns workout details', async () => {
      jest.mocked(axios).get.mockResolvedValueOnce({
        data: {
          payload: {
            workoutId: 1,
            workoutKey: '1',
            workoutName: 'name',
            activityId: 1,
            description: 'description',
            startTime: 1,
            totalTime: 1,
            totalAscent: 1.2,
            totalDistance: 1.2,
            timeOffsetInMinutes: 0,
          },
          metadata: {},
        },
      });

      const api = new SuuntoApi();
      const result = await api.getWorkoutDetails('1', 'token', 'subscription');

      expect(result).toMatchInlineSnapshot(`
        {
          "metadata": {},
          "payload": {
            "activityId": 1,
            "description": "description",
            "startTime": 1,
            "timeOffsetInMinutes": 0,
            "totalAscent": 1.2,
            "totalDistance": 1.2,
            "totalTime": 1,
            "workoutId": 1,
            "workoutKey": "1",
            "workoutName": "name",
          },
        }
      `);
      expect(axios.get).toBeCalledTimes(1);
    });
  });

  describe('getFIT', () => {
    it('throws if request failed', async () => {
      jest.mocked(axios).get.mockRejectedValueOnce(undefined);

      const api = new SuuntoApi();

      await expect(api.getFIT('1', 'token', 'subscription')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto getFIT request]`,
      );
      expect(axios.get).toBeCalledTimes(1);
    });

    it('throws if request response is invalid', async () => {
      jest.mocked(axios).get.mockResolvedValueOnce({});

      const api = new SuuntoApi();

      await expect(api.getFIT('1', 'token', 'subscription')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto getFIT request]`,
      );
      expect(axios.get).toBeCalledTimes(1);
    });

    it('returns FIT', async () => {
      jest.mocked(axios).get.mockResolvedValueOnce({ data: new ArrayBuffer(1) });

      const api = new SuuntoApi();
      const result = await api.getFIT('1', 'token', 'subscription');

      expect(result).toMatchInlineSnapshot(`ArrayBuffer []`);
      expect(axios.get).toBeCalledTimes(1);
    });
  });

  describe('deauthorize', () => {
    it('throws if request failed', async () => {
      jest.mocked(axios).get.mockRejectedValueOnce(undefined);

      const api = new SuuntoApi();

      await expect(api.deauthorize('token')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto deauthorize request]`,
      );
      expect(axios.get).toBeCalledTimes(1);
    });

    it('calls API', async () => {
      jest.mocked(axios).get.mockResolvedValueOnce(undefined);

      const api = new SuuntoApi();
      await api.deauthorize('token');

      expect(axios.get).toBeCalledTimes(1);
    });
  });
});
