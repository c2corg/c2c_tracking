import { beforeEach, describe, expect, it, vi } from 'vitest';

import { http } from '../../../../src/helpers/http.ts';
import type { Activity, DecathlonAuth, WebhookSubscription } from '../../../../src/server/decathlon/decathlon.api.ts';
import { DecathlonApi } from '../../../../src/server/decathlon/decathlon.api.ts';
import { respond } from '../../../utils.ts';

// the HTTP calls are mocked, not the errors
vi.mock('../../../../src/helpers/http.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  http: { get: vi.fn(), post: vi.fn(), postForm: vi.fn(), delete: vi.fn() },
}));

describe('Decathlon API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exchangeToken', () => {
    it('calls decathlon API', async () => {
      const auth: DecathlonAuth = {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
      };
      vi.mocked(http).post.mockResolvedValueOnce(respond(auth));

      const api = new DecathlonApi();
      const result = await api.exchangeToken('code');

      expect(http.post).toHaveBeenCalledTimes(1);
      expect(http.post).toHaveBeenCalledWith('https://api-global.decathlon.net/connect/oauth/token', null, {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        params: expect.objectContaining({ code: 'code' }),
      });
      expect(result).toMatchInlineSnapshot(`
        {
          "access_token": "access_token",
          "expires_in": 1,
          "refresh_token": "refresh_token",
          "token_type": "bearer",
        }
      `);
    });
  });

  describe('refreshAuth', () => {
    it('calls decathlon API', async () => {
      const refreshAuth: DecathlonAuth = {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
      };
      vi.mocked(http).postForm.mockResolvedValueOnce(respond(refreshAuth));

      const api = new DecathlonApi();
      const result = await api.refreshAuth('refresh_token');

      expect(result).toMatchInlineSnapshot(`
        {
          "access_token": "access_token",
          "expires_in": 1,
          "refresh_token": "refresh_token",
          "token_type": "bearer",
        }
      `);
      expect(http.postForm).toHaveBeenCalledTimes(1);
      expect(http.postForm).toHaveBeenCalledWith(
        'https://api-global.decathlon.net/connect/oauth/token',
        { grant_type: 'refresh_token', refresh_token: 'refresh_token' },
        {
          auth: { username: 'b708af3b-fd46-41ab-af73-5176a0a56f92', password: 'c2VjcmV0' },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
    });
  });

  describe('getUserId', () => {
    it('calls decathlon API', async () => {
      vi.mocked(http).get.mockResolvedValueOnce(respond({ id: 'userId' }));

      const api = new DecathlonApi();
      const result = await api.getUserId('access_token');

      expect(result).toEqual('userId');
      expect(http.get).toHaveBeenCalledTimes(1);
      expect(http.get).toHaveBeenCalledWith('https://api-global.decathlon.net/sportstrackingdata/v2/me', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({ Authorization: 'Bearer access_token' }),
      });
    });
  });

  describe('getActivities', () => {
    it('calls decathlon API', async () => {
      const activities: Activity[] = [
        {
          id: '12345',
          name: 'Afternoon Run',
          sport: '/v2/sports/381',
          startdate: '2022-01-01T00:00:01Z',
          dataSummaries: {},
        },
      ];
      vi.mocked(http).get.mockResolvedValueOnce(respond(activities));

      const api = new DecathlonApi();
      const result = await api.getActivities('access_token');

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "dataSummaries": {},
            "id": "12345",
            "name": "Afternoon Run",
            "sport": "/v2/sports/381",
            "startdate": "2022-01-01T00:00:01Z",
          },
        ]
      `);
      expect(http.get).toHaveBeenCalledTimes(1);
      expect(http.get).toHaveBeenCalledWith('https://api-global.decathlon.net/sportstrackingdata/v2/activities', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({ Authorization: 'Bearer access_token' }),
      });
    });
  });

  describe('getActivity', () => {
    it('calls decathlon API', async () => {
      const activity: Activity = {
        id: '12345',
        name: 'Afternoon Run',
        sport: '/v2/sports/381',
        startdate: '2022-01-01T00:00:01Z',
        dataSummaries: {},
        locations: {
          '1': { longitude: 1.0, latitude: 1.0, elevation: 1.0 },
        },
      };
      vi.mocked(http).get.mockResolvedValueOnce(respond(activity));

      const api = new DecathlonApi();
      const result = await api.getActivity('access_token', '12345');

      expect(result).toMatchInlineSnapshot(`
        {
          "dataSummaries": {},
          "id": "12345",
          "locations": {
            "1": {
              "elevation": 1,
              "latitude": 1,
              "longitude": 1,
            },
          },
          "name": "Afternoon Run",
          "sport": "/v2/sports/381",
          "startdate": "2022-01-01T00:00:01Z",
        }
      `);
      expect(http.get).toHaveBeenCalledTimes(1);
      expect(http.get).toHaveBeenCalledWith('https://api-global.decathlon.net/sportstrackingdata/v2/activities/12345', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({ Authorization: 'Bearer access_token' }),
      });
    });
  });

  describe('getExistingWebhookSubscription', () => {
    it('calls decathlon API', async () => {
      const subscriptions: WebhookSubscription[] = [
        {
          id: 'badsubscription',
          user: '/v2/users/1',
          url: 'http://nowhere.com',
          events: ['activity_create', 'activity_delete'],
        },
        {
          id: 'goodsubscription',
          user: '/v2/users/1',
          url: 'http://localhost:3000/decathlon/webhook',
          events: ['activity_create', 'activity_delete'],
        },
      ];
      vi.mocked(http).get.mockResolvedValueOnce(respond(subscriptions));

      const api = new DecathlonApi();
      const result = await api.getExistingWebhookSubscription('access_token');

      expect(result).toEqual('goodsubscription');
      expect(http.get).toHaveBeenCalledTimes(1);
      expect(http.get).toHaveBeenCalledWith('https://api-global.decathlon.net/sportstrackingdata/v2/user_web_hooks', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({ Authorization: 'Bearer access_token' }),
      });
    });

    it('returns undefined if no matching subscription is found', async () => {
      const subscriptions: WebhookSubscription[] = [
        {
          id: 'badsubscription',
          user: '/v2/users/1',
          url: 'http://nowhere.com',
          events: ['activity_create', 'activity_delete'],
        },
      ];
      vi.mocked(http).get.mockResolvedValueOnce(respond(subscriptions));

      const api = new DecathlonApi();
      const result = await api.getExistingWebhookSubscription('access_token');

      expect(result).toBeUndefined();
      expect(http.get).toHaveBeenCalledTimes(1);
      expect(http.get).toHaveBeenCalledWith('https://api-global.decathlon.net/sportstrackingdata/v2/user_web_hooks', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({ Authorization: 'Bearer access_token' }),
      });
    });
  });

  describe('createWebhookSubscription', () => {
    it('calls decathlon API', async () => {
      const activity: WebhookSubscription = {
        id: '12345',
        user: '/v2/users/1',
        url: 'http://nowhere.com',
        events: ['activity_create', 'activity_delete'],
      };
      vi.mocked(http).post.mockResolvedValueOnce(respond(activity));

      const api = new DecathlonApi();
      const result = await api.createWebhookSubscription('1', 'access_token');

      expect(result).toMatchInlineSnapshot(`"12345"`);
      expect(http.post).toHaveBeenCalledTimes(1);
      expect(http.post).toHaveBeenCalledWith(
        'https://api-global.decathlon.net/sportstrackingdata/v2/user_web_hooks',
        expect.objectContaining({ user: `/v2/users/1` }),
        {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          headers: expect.objectContaining({ Authorization: 'Bearer access_token' }),
        },
      );
    });
  });

  describe('deleteWebhookSubscription', () => {
    it('calls decathlon API', async () => {
      vi.mocked(http).delete.mockResolvedValueOnce(respond(undefined));

      const api = new DecathlonApi();
      const result = await api.deleteWebhookSubscription('1', 'access_token');

      expect(result).toMatchInlineSnapshot(`undefined`);
      expect(http.delete).toHaveBeenCalledTimes(1);
      expect(http.delete).toHaveBeenCalledWith(
        'https://api-global.decathlon.net/sportstrackingdata/v2/user_web_hooks/1',
        {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          headers: expect.objectContaining({ Authorization: 'Bearer access_token' }),
        },
      );
    });
  });
});
