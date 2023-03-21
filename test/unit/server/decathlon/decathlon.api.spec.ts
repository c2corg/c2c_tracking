import axios from 'axios';

import {
  Activity,
  DecathlonApi,
  DecathlonAuth,
  WebhookSubscription,
} from '../../../../src/server/decathlon/decathlon.api';

jest.mock('axios');

describe('Decathlon API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exchangeToken', () => {
    it('calls decathlon API', async () => {
      const auth: DecathlonAuth = {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
      };
      jest.mocked(axios).post.mockResolvedValueOnce({ data: auth });

      const api = new DecathlonApi();
      const result = await api.exchangeToken('code');

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith('https://api-global.decathlon.net/connect/oauth/token', null, {
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
      jest.mocked(axios).postForm.mockResolvedValueOnce({ data: refreshAuth });

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
      expect(axios.postForm).toHaveBeenCalledTimes(1);
      expect(axios.postForm).toHaveBeenCalledWith(
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
      jest.mocked(axios).get.mockResolvedValueOnce({ data: { id: 'userId' } });

      const api = new DecathlonApi();
      const result = await api.getUserId('access_token');

      expect(result).toEqual('userId');
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledWith('https://api-global.decathlon.net/sportstrackingdata/v2/me', {
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
      jest.mocked(axios).get.mockResolvedValueOnce({ data: activities });

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
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledWith('https://api-global.decathlon.net/sportstrackingdata/v2/activities', {
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
      jest.mocked(axios).get.mockResolvedValueOnce({ data: activity });

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
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledWith(
        'https://api-global.decathlon.net/sportstrackingdata/v2/activities/12345',
        {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          headers: expect.objectContaining({ Authorization: 'Bearer access_token' }),
        },
      );
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
      jest.mocked(axios).get.mockResolvedValueOnce({ data: subscriptions });

      const api = new DecathlonApi();
      const result = await api.getExistingWebhookSubscription('access_token');

      expect(result).toEqual('goodsubscription');
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledWith('https://api-global.decathlon.net/sportstrackingdata/v2/user_web_hooks', {
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
      jest.mocked(axios).get.mockResolvedValueOnce({ data: subscriptions });

      const api = new DecathlonApi();
      const result = await api.getExistingWebhookSubscription('access_token');

      expect(result).toBeUndefined();
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledWith('https://api-global.decathlon.net/sportstrackingdata/v2/user_web_hooks', {
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
      jest.mocked(axios).post.mockResolvedValueOnce({ data: activity });

      const api = new DecathlonApi();
      const result = await api.createWebhookSubscription('1', 'access_token');

      expect(result).toMatchInlineSnapshot(`"12345"`);
      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
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
      jest.mocked(axios).delete.mockResolvedValueOnce({ data: undefined });

      const api = new DecathlonApi();
      const result = await api.deleteWebhookSubscription('1', 'access_token');

      expect(result).toMatchInlineSnapshot(`undefined`);
      expect(axios.delete).toHaveBeenCalledTimes(1);
      expect(axios.delete).toHaveBeenCalledWith(
        'https://api-global.decathlon.net/sportstrackingdata/v2/user_web_hooks/1',
        {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          headers: expect.objectContaining({ Authorization: 'Bearer access_token' }),
        },
      );
    });
  });
});
