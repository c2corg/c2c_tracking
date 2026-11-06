import { beforeEach, describe, expect, it, vi } from 'vitest';

import { http } from '../../../../src/helpers/http.ts';
import log from '../../../../src/helpers/logger.ts';
import { SuuntoApi } from '../../../../src/server/suunto/suunto.api.ts';
import { respond } from '../../../utils.ts';

// the HTTP calls are mocked, not the errors
vi.mock('../../../../src/helpers/http.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  http: { get: vi.fn(), post: vi.fn(), postForm: vi.fn(), delete: vi.fn() },
}));

describe('Suunto API', () => {
  beforeEach(() => {
    vi.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    vi.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
    vi.clearAllMocks();
  });

  describe('exchangeToken', () => {
    it('throws if request failed', async () => {
      vi.mocked(http).post.mockRejectedValueOnce(undefined);

      const api = new SuuntoApi();

      await expect(api.exchangeToken('code')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto token exchange request]`,
      );
      expect(http.post).toHaveBeenCalledTimes(1);
    });

    it('throws if request response is invalid', async () => {
      vi.mocked(http).post.mockResolvedValueOnce(respond());

      const api = new SuuntoApi();

      await expect(api.exchangeToken('code')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto token exchange request]`,
      );
      expect(http.post).toHaveBeenCalledTimes(1);
    });

    it('returns auth', async () => {
      vi.mocked(http).post.mockResolvedValueOnce(
        respond({
          access_token: 'access_token',
          token_type: 'bearer',
          refresh_token: 'refresh_token',
          expires_in: 1,
          user: 'user',
        }),
      );

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
      expect(http.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshAuth', () => {
    it('throws if request failed', async () => {
      vi.mocked(http).post.mockRejectedValueOnce(undefined);

      const api = new SuuntoApi();

      await expect(api.refreshAuth('token')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto refresh token request]`,
      );
      expect(http.post).toHaveBeenCalledTimes(1);
    });

    it('throws if request response is invalid', async () => {
      vi.mocked(http).post.mockResolvedValueOnce(respond());

      const api = new SuuntoApi();

      await expect(api.refreshAuth('token')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto refresh token request]`,
      );
      expect(http.post).toHaveBeenCalledTimes(1);
    });

    it('returns refresh auth', async () => {
      vi.mocked(http).post.mockResolvedValueOnce(
        respond({
          access_token: 'access_token',
          token_type: 'bearer',
          refresh_token: 'refresh_token',
          expires_in: 1,
          user: 'user',
        }),
      );

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
      expect(http.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('getWorkouts', () => {
    it('throws if request failed', async () => {
      vi.mocked(http).get.mockRejectedValueOnce(undefined);

      const api = new SuuntoApi();

      await expect(api.getWorkouts('token', 'subscription')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto getWorkouts request]`,
      );
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('throws if request response is invalid', async () => {
      vi.mocked(http).get.mockResolvedValueOnce(respond());

      const api = new SuuntoApi();

      await expect(api.getWorkouts('token', 'subscription')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto getWorkouts request]`,
      );
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('returns workouts', async () => {
      vi.mocked(http).get.mockResolvedValueOnce(
        respond({
          payload: [
            {
              workoutId: 1,
              workoutKey: '1',
              workoutName: 'name',
              activityId: 1,
              startTime: 1,
              totalTime: 1,
              totalAscent: 1.2,
              totalDistance: 1.2,
              timeOffsetInMinutes: 0,
            },
          ],
          metadata: {},
        }),
      );

      const api = new SuuntoApi();
      const result = await api.getWorkouts('token', 'subscription');

      expect(result).toMatchInlineSnapshot(`
        {
          "metadata": {},
          "payload": [
            {
              "activityId": 1,
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
      expect(http.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getWorkoutDetails', () => {
    it('throws if request failed', async () => {
      vi.mocked(http).get.mockRejectedValueOnce(undefined);

      const api = new SuuntoApi();

      await expect(api.getWorkoutDetails('1', 'token', 'subscription')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto getWorkoutDetails request]`,
      );
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('throws if request response is invalid', async () => {
      vi.mocked(http).get.mockResolvedValueOnce(respond());

      const api = new SuuntoApi();

      await expect(api.getWorkoutDetails('1', 'token', 'subscription')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto getWorkoutDetails request]`,
      );
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('returns workout details', async () => {
      vi.mocked(http).get.mockResolvedValueOnce(
        respond({
          payload: {
            workoutId: 1,
            workoutKey: '1',
            workoutName: 'name',
            activityId: 1,
            startTime: 1,
            totalTime: 1,
            totalAscent: 1.2,
            totalDistance: 1.2,
            timeOffsetInMinutes: 0,
          },
          metadata: {},
        }),
      );

      const api = new SuuntoApi();
      const result = await api.getWorkoutDetails('1', 'token', 'subscription');

      expect(result).toMatchInlineSnapshot(`
        {
          "metadata": {},
          "payload": {
            "activityId": 1,
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
      expect(http.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFIT', () => {
    it('throws if request failed', async () => {
      vi.mocked(http).get.mockRejectedValueOnce(undefined);

      const api = new SuuntoApi();

      await expect(api.getFIT('1', 'token', 'subscription')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto getFIT request]`,
      );
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('returns FIT', async () => {
      vi.mocked(http).get.mockResolvedValueOnce(respond(new ArrayBuffer(1)));

      const api = new SuuntoApi();
      const result = await api.getFIT('1', 'token', 'subscription');

      expect(result).toMatchInlineSnapshot(`
        ArrayBuffer [
          0,
        ]
      `);
      expect(http.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('deauthorize', () => {
    it('throws if request failed', async () => {
      vi.mocked(http).get.mockRejectedValueOnce(undefined);

      const api = new SuuntoApi();

      await expect(api.deauthorize('token')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Suunto deauthorize request]`,
      );
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('calls API', async () => {
      vi.mocked(http).get.mockResolvedValueOnce(respond());

      const api = new SuuntoApi();
      await api.deauthorize('token');

      expect(http.get).toHaveBeenCalledTimes(1);
    });
  });
});
