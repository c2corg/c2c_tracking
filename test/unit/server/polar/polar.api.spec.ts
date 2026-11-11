import { beforeEach, describe, expect, it, vi } from 'vitest';

import { http } from '../../../../src/helpers/http.ts';
import log from '../../../../src/helpers/logger.ts';
import type { CreatedWebhookInfo, Exercise, PolarAuth, WebhookInfo } from '../../../../src/server/polar/polar.api.ts';
import { PolarApi, sportType } from '../../../../src/server/polar/polar.api.ts';
import { respond } from '../../../utils.ts';

// the HTTP calls are mocked, not the errors
vi.mock('../../../../src/helpers/http.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  http: { get: vi.fn(), post: vi.fn(), postForm: vi.fn(), delete: vi.fn() },
}));

describe('Polar API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    vi.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  describe('exchangeToken', () => {
    it('throws if request fails', async () => {
      vi.mocked(http).post.mockRejectedValueOnce(undefined);

      const api = new PolarApi();

      await expect(api.exchangeToken('code')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Polar token exchange request]`,
      );
      expect(http.post).toHaveBeenCalledTimes(1);
    });

    it('calls polar API', async () => {
      const auth: PolarAuth = { access_token: 'access_token', token_type: 'bearer', x_user_id: 1n };
      vi.mocked(http).post.mockResolvedValueOnce(respond(auth));

      const api = new PolarApi();
      const result = await api.exchangeToken('code');

      expect(http.post).toHaveBeenCalledTimes(1);
      expect(http.post).toHaveBeenCalledWith(
        'https://polarremote.com/v2/oauth2/token',
        {
          code: 'code',
          grant_type: 'authorization_code',
          redirect_uri: 'http://localhost:8080/trackers/polar/exchange-token',
        },
        {
          auth: { username: '5a9f9ddd-fc15-48d2-bc56-86b43d491cc9', password: '902d20cc-c2a8-4536-89a9-41e0f7626977' },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
      expect(result).toMatchInlineSnapshot(`
        {
          "access_token": "access_token",
          "token_type": "bearer",
          "x_user_id": 1n,
        }
      `);
    });
  });

  describe('registerUser', () => {
    it('throws if request fails', async () => {
      vi.mocked(http).post.mockRejectedValueOnce(undefined);

      const api = new PolarApi();

      await expect(api.registerUser('token', 1n)).rejects.toMatchInlineSnapshot(
        `[Error: Error on Polar register user request]`,
      );
      expect(http.post).toHaveBeenCalledTimes(1);
    });

    it('calls polar API', async () => {
      vi.mocked(http).post.mockResolvedValueOnce(respond());

      const api = new PolarApi();
      await api.registerUser('token', 1n);

      expect(http.post).toHaveBeenCalledTimes(1);
      expect(http.post).toHaveBeenCalledWith(
        'https://www.polaraccesslink.com/v3/users',
        { 'member-id': '1' },
        expect.objectContaining({ headers: { Authorization: `Bearer token` } }),
      );
    });
  });

  describe('deleteUser', () => {
    it('throws if request fails', async () => {
      vi.mocked(http).delete.mockRejectedValueOnce(undefined);

      const api = new PolarApi();

      await expect(api.deleteUser('token', 1n)).rejects.toMatchInlineSnapshot(
        `[Error: Error on Polar delete user request]`,
      );
      expect(http.delete).toHaveBeenCalledTimes(1);
    });

    it('calls polar API', async () => {
      vi.mocked(http).delete.mockResolvedValueOnce(respond());

      const api = new PolarApi();
      await api.deleteUser('token', 1n);

      expect(http.delete).toHaveBeenCalledTimes(1);
      expect(http.delete).toHaveBeenCalledWith('https://www.polaraccesslink.com/v3/users/1', {
        headers: { Authorization: `Bearer token` },
      });
    });
  });

  describe('getExercise', () => {
    it('throws if request fails', async () => {
      vi.mocked(http).get.mockRejectedValueOnce(undefined);

      const api = new PolarApi();

      await expect(api.getExercise('token', 'exerciseId')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Polar delete user request]`,
      );
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('calls polar API', async () => {
      const exercise: Exercise = {
        id: 'exerciseId',
        sport: 'RUN',
        start_time: '1970-01-01T00:00:01',
        start_time_utc_offset: 0,
        distance: 1,
        duration: 'PT1S',
      };
      vi.mocked(http).get.mockResolvedValueOnce(respond(exercise));

      const api = new PolarApi();
      const result = await api.getExercise('token', 'exerciseId');

      expect(http.get).toHaveBeenCalledTimes(1);
      expect(http.get).toHaveBeenCalledWith('https://www.polaraccesslink.com/v3/exercises/exerciseId', {
        headers: { Authorization: `Bearer token` },
      });
      expect(result).toMatchInlineSnapshot(`
        {
          "distance": 1,
          "duration": "PT1S",
          "id": "exerciseId",
          "sport": "RUN",
          "start_time": "1970-01-01T00:00:01",
          "start_time_utc_offset": 0,
        }
      `);
    });
  });

  describe('getExerciseFit', () => {
    it('throws if request fails', async () => {
      vi.mocked(http).get.mockRejectedValueOnce(undefined);

      const api = new PolarApi();

      await expect(api.getExerciseFit('token', 'exerciseId')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Polar getExrciseFIT request]`,
      );
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('returns FIT', async () => {
      vi.mocked(http).get.mockResolvedValueOnce(respond(new ArrayBuffer(1)));

      const api = new PolarApi();
      const result = await api.getExerciseFit('token', 'exerciseId');

      expect(result).toMatchInlineSnapshot(`
        ArrayBuffer [
          0,
        ]
      `);
      expect(http.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('createWebhook', () => {
    it('throws if request fails', async () => {
      vi.mocked(http).post.mockRejectedValueOnce(undefined);

      const api = new PolarApi();

      await expect(api.createWebhook()).rejects.toMatchInlineSnapshot(`[Error: Error on Polar create webhook request]`);
      expect(http.post).toHaveBeenCalledTimes(1);
    });

    it('calls polar API', async () => {
      const webhookInfo: CreatedWebhookInfo = {
        data: {
          id: '1',
          events: ['EXERCISE'],
          url: 'http://perdu.com',
          signature_secret_key: '6a123180-b5a2-4ffe-aa74-4aa03cc3f712',
        },
      };
      vi.mocked(http).post.mockResolvedValueOnce(respond(webhookInfo));

      const api = new PolarApi();
      const result = await api.createWebhook();

      expect(result).toEqual('6a123180-b5a2-4ffe-aa74-4aa03cc3f712');
      expect(http.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('getWebhook', () => {
    it('throws if request fails', async () => {
      vi.mocked(http).get.mockRejectedValueOnce(undefined);

      const api = new PolarApi();

      await expect(api.getWebhook()).rejects.toMatchInlineSnapshot(`[Error: Error on Polar get webhook request]`);
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('calls polar API', async () => {
      const webhookInfo: WebhookInfo = { data: [{ id: '1', events: ['EXERCISE'], url: 'http://perdu.com' }] };
      vi.mocked(http).get.mockResolvedValueOnce(respond(webhookInfo));

      const api = new PolarApi();
      const result = await api.getWebhook();

      expect(result).toMatchInlineSnapshot(`
        {
          "data": [
            {
              "events": [
                "EXERCISE",
              ],
              "id": "1",
              "url": "http://perdu.com",
            },
          ],
        }
      `);
      expect(http.get).toHaveBeenCalledTimes(1);
    });
  });
  describe('sportType', () => {
    const exercise: Exercise = {
      id: 'exerciseId',
      start_time: '1970-01-01T00:00:01',
      start_time_utc_offset: 0,
    };

    it('uses the detailed sport info', () => {
      expect(sportType({ ...exercise, sport: 'OTHER', detailed_sport_info: 'BACKCOUNTRY_SKIING' })).toBe(
        'BACKCOUNTRY_SKIING',
      );
      expect(sportType({ ...exercise, detailed_sport_info: 'CROSS-COUNTRY_SKIING' })).toBe('CROSS-COUNTRY_SKIING');
    });

    it('falls back on the sport', () => {
      expect(sportType({ ...exercise, sport: 'HIKING', detailed_sport_info: 'NEW_SPORT' })).toBe('HIKING');
      expect(sportType({ ...exercise, sport: 'HIKING' })).toBe('HIKING');
    });

    it('is unknown otherwise', () => {
      expect(sportType({ ...exercise, sport: 'OTHER', detailed_sport_info: 'NEW_SPORT' })).toBe('Unknown');
      expect(sportType(exercise)).toBe('Unknown');
    });
  });
});
