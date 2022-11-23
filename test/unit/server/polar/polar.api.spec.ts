import axios, { AxiosError } from 'axios';

import log from '../../../../src/helpers/logger';
import { CreatedWebhookInfo, Exercise, PolarApi, PolarAuth, WebhookInfo } from '../../../../src/server/polar/polar.api';

jest.mock('axios');

describe('Polar API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(log, 'info').mockImplementation(() => Promise.resolve());
    jest.spyOn(log, 'warn').mockImplementation(() => Promise.resolve());
  });

  describe('exchangeToken', () => {
    it('throws if request fails', async () => {
      jest.mocked(axios).post.mockRejectedValueOnce(undefined);

      const api = new PolarApi();

      await expect(api.exchangeToken('code')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Polar token exchange request]`,
      );
      expect(axios.post).toBeCalledTimes(1);
    });

    it('calls polar API', async () => {
      const auth: PolarAuth = {
        access_token: 'access_token',
        token_type: 'bearer',
        x_user_id: 1,
      };
      jest.mocked(axios).post.mockResolvedValueOnce({ data: auth });

      const api = new PolarApi();
      const result = await api.exchangeToken('code');

      expect(axios.post).toBeCalledTimes(1);
      expect(axios.post).toBeCalledWith(
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
          "x_user_id": 1,
        }
      `);
    });
  });

  describe('registerUser', () => {
    it('throws if request fails', async () => {
      jest.mocked(axios).post.mockRejectedValueOnce(undefined);

      const api = new PolarApi();

      await expect(api.registerUser('token', 1)).rejects.toMatchInlineSnapshot(
        `[Error: Error on Polar register user request]`,
      );
      expect(axios.post).toBeCalledTimes(1);
    });

    it('ignore 409 error', async () => {
      const error = {
        status: 409,
        message: 'User userid:1 with membertag 1 has already registered with partner camptocamp.org',
        isAxiosError: true,
      } as AxiosError;
      jest.mocked(axios).post.mockRejectedValueOnce(error);
      jest.mocked(axios).isAxiosError.mockReturnValue(true);

      const api = new PolarApi();
      await api.registerUser('token', 1);

      expect(axios.post).toBeCalledTimes(1);
      expect(axios.post).toBeCalledWith(
        'https://www.polaraccesslink.com/v3/users',
        { 'member-id': '1' },
        { headers: { Authorization: `Bearer token` } },
      );
    });

    it('calls polar API', async () => {
      jest.mocked(axios).post.mockResolvedValueOnce(undefined);

      const api = new PolarApi();
      await api.registerUser('token', 1);

      expect(axios.post).toBeCalledTimes(1);
      expect(axios.post).toBeCalledWith(
        'https://www.polaraccesslink.com/v3/users',
        { 'member-id': '1' },
        { headers: { Authorization: `Bearer token` } },
      );
    });
  });

  describe('deleteUser', () => {
    it('throws if request fails', async () => {
      jest.mocked(axios).delete.mockRejectedValueOnce(undefined);

      const api = new PolarApi();

      await expect(api.deleteUser('token', 1)).rejects.toMatchInlineSnapshot(
        `[Error: Error on Polar delete user request]`,
      );
      expect(axios.delete).toBeCalledTimes(1);
    });

    it('calls polar API', async () => {
      jest.mocked(axios).delete.mockResolvedValueOnce(undefined);

      const api = new PolarApi();
      await api.deleteUser('token', 1);

      expect(axios.delete).toBeCalledTimes(1);
      expect(axios.delete).toBeCalledWith('https://www.polaraccesslink.com/v3/users/1', {
        headers: { Authorization: `Bearer token` },
      });
    });
  });

  describe('getExercise', () => {
    it('throws if request fails', async () => {
      jest.mocked(axios).get.mockRejectedValueOnce(undefined);

      const api = new PolarApi();

      await expect(api.getExercise('token', 'exerciseId')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Polar delete user request]`,
      );
      expect(axios.get).toBeCalledTimes(1);
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
      jest.mocked(axios).get.mockResolvedValueOnce({ data: exercise });

      const api = new PolarApi();
      const result = await api.getExercise('token', 'exerciseId');

      expect(axios.get).toBeCalledTimes(1);
      expect(axios.get).toBeCalledWith('https://www.polaraccesslink.com/v3/exercises/exerciseId', {
        headers: { Authorization: `Bearer token` },
      });
      expect(result).toMatchInlineSnapshot(`
        {
          "distance": 1,
          "duration": "PT1S",
          "id": "exerciseId",
          "sport": "Unknown",
          "start_time": "1970-01-01T00:00:01",
          "start_time_utc_offset": 0,
        }
      `);
    });
  });

  describe('getExerciseFit', () => {
    it('throws if request fails', async () => {
      jest.mocked(axios).get.mockRejectedValueOnce(undefined);

      const api = new PolarApi();

      await expect(api.getExerciseFit('token', 'exerciseId')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Polar getExrciseFIT request]`,
      );
      expect(axios.get).toBeCalledTimes(1);
    });

    it('throws if request failed', async () => {
      jest.mocked(axios).get.mockRejectedValueOnce(undefined);

      const api = new PolarApi();

      await expect(api.getExerciseFit('token', 'exerciseId')).rejects.toMatchInlineSnapshot(
        `[Error: Error on Polar getExrciseFIT request]`,
      );
      expect(axios.get).toBeCalledTimes(1);
    });

    it('returns FIT', async () => {
      jest.mocked(axios).get.mockResolvedValueOnce({ data: new ArrayBuffer(1) });

      const api = new PolarApi();
      const result = await api.getExerciseFit('token', 'exerciseId');

      expect(result).toMatchInlineSnapshot(`ArrayBuffer []`);
      expect(axios.get).toBeCalledTimes(1);
    });
  });

  describe('createWebhook', () => {
    it('throws if request fails', async () => {
      jest.mocked(axios).post.mockRejectedValueOnce(undefined);

      const api = new PolarApi();

      await expect(api.createWebhook()).rejects.toMatchInlineSnapshot(`[Error: Error on Polar create webhook request]`);
      expect(axios.post).toBeCalledTimes(1);
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
      jest.mocked(axios).post.mockResolvedValueOnce({ data: webhookInfo });

      const api = new PolarApi();
      const result = await api.createWebhook();

      expect(result).toEqual('6a123180-b5a2-4ffe-aa74-4aa03cc3f712');
      expect(axios.post).toBeCalledTimes(1);
    });
  });

  describe('getWebhook', () => {
    it('throws if request fails', async () => {
      jest.mocked(axios).get.mockRejectedValueOnce(undefined);

      const api = new PolarApi();

      await expect(api.getWebhook()).rejects.toMatchInlineSnapshot(`[Error: Error on Polar get webhook request]`);
      expect(axios.get).toBeCalledTimes(1);
    });

    it('calls polar API', async () => {
      const webhookInfo: WebhookInfo = {
        data: [
          {
            id: '1',
            events: ['EXERCISE'],
            url: 'http://perdu.com',
          },
        ],
      };
      jest.mocked(axios).get.mockResolvedValueOnce({ data: webhookInfo });

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
      expect(axios.get).toBeCalledTimes(1);
    });
  });
});
