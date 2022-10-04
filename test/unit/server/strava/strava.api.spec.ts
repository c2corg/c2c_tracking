import axios from 'axios';
import FormData from 'form-data';

import {
  Activity,
  StravaApi,
  StravaAuth,
  StravaRefreshAuth,
  StreamSet,
  Subscription,
} from '../../../../src/server/strava/strava.api';

jest.mock('axios');
jest.mock('form-data');

describe('Strava API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exchangeToken', () => {
    it('call strava API', async () => {
      const auth: StravaAuth = {
        athlete: { id: 1 },
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: 1,
        expires_in: 1,
      };
      jest.mocked(axios).post.mockResolvedValueOnce({ data: auth });

      const api = new StravaApi();
      const result = await api.exchangeToken('code');

      expect(axios.post).toBeCalledTimes(1);
      expect(axios.post).toBeCalledWith('https://www.strava.com/api/v3/oauth/token', null, {
        params: expect.objectContaining({ code: 'code' }),
      });
      expect(result).toMatchInlineSnapshot(`
        {
          "access_token": "access_token",
          "athlete": {
            "id": 1,
          },
          "expires_at": 1,
          "expires_in": 1,
          "refresh_token": "refresh_token",
        }
      `);
    });
  });

  describe('deauthorize', () => {
    it('calls strava API', async () => {
      jest.mocked(axios).post.mockResolvedValueOnce(undefined);

      const api = new StravaApi();
      await api.deauthorize('token');

      expect(axios.post).toBeCalledTimes(1);
      expect(axios.post).toBeCalledWith('https://www.strava.com/api/v3/oauth/deauthorize?access_token=token');
    });
  });

  describe('refreshAuth', () => {
    it('calls strava API', async () => {
      const refreshAuth: StravaRefreshAuth = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: 1,
        expires_in: 1,
      };
      jest.mocked(axios).post.mockResolvedValueOnce({ data: refreshAuth });

      const api = new StravaApi();
      const result = await api.refreshAuth('refresh_token');

      expect(result).toMatchInlineSnapshot(`
        {
          "access_token": "access_token",
          "expires_at": 1,
          "expires_in": 1,
          "refresh_token": "refresh_token",
        }
      `);
      expect(axios.post).toBeCalledTimes(1);
      expect(axios.post).toBeCalledWith('https://www.strava.com/api/v3/oauth/token', null, {
        params: expect.objectContaining({ refresh_token: 'refresh_token' }),
      });
    });
  });

  describe('getAthleteActivities', () => {
    it('calls strava API', async () => {
      const activities: Activity[] = [
        {
          id: 123,
          name: 'Afternoon Run',
          type: 'Run',
          start_date: '2022-01-01T00:00:01Z',
          start_latlng: [1.0, 1.0],
          timezone: 'Paris/Europe',
          map: { summary_polyline: 'abcd' },
        },
      ];
      jest.mocked(axios).get.mockResolvedValueOnce({ data: activities });

      const api = new StravaApi();
      const result = await api.getAthleteActivities('access_token');

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "id": 123,
            "map": {
              "summary_polyline": "abcd",
            },
            "name": "Afternoon Run",
            "start_date": "2022-01-01T00:00:01Z",
            "start_latlng": [
              1,
              1,
            ],
            "timezone": "Paris/Europe",
            "type": "Run",
          },
        ]
      `);
      expect(axios.get).toBeCalledTimes(1);
      expect(axios.get).toBeCalledWith('https://www.strava.com/api/v3/athlete/activities', {
        headers: { Authorization: 'Bearer access_token' },
      });
    });
  });

  describe('getActivity', () => {
    it('calls strava API', async () => {
      const activity: Activity = {
        id: 123,
        name: 'Afternoon Run',
        type: 'Run',
        start_date: '2022-01-01T00:00:01Z',
        start_latlng: [1.0, 1.0],
        timezone: 'Paris/Europe',
        map: { summary_polyline: 'abcd' },
      };
      jest.mocked(axios).get.mockResolvedValueOnce({ data: activity });

      const api = new StravaApi();
      const result = await api.getActivity('access_token', '123');

      expect(result).toMatchInlineSnapshot(`
        {
          "id": 123,
          "map": {
            "summary_polyline": "abcd",
          },
          "name": "Afternoon Run",
          "start_date": "2022-01-01T00:00:01Z",
          "start_latlng": [
            1,
            1,
          ],
          "timezone": "Paris/Europe",
          "type": "Run",
        }
      `);
      expect(axios.get).toBeCalledTimes(1);
      expect(axios.get).toBeCalledWith('https://www.strava.com/api/v3/activities/123', {
        headers: { Authorization: 'Bearer access_token' },
      });
    });
  });

  describe('getActivityStream', () => {
    it('calls strava API', async () => {
      const streamSet: StreamSet = [
        {
          type: 'latlng',
          series_type: 'distance',
          original_size: 2,
          resolution: 'low',
          data: [
            [1.0, 1.0],
            [2.0, 2.0],
          ],
        },
      ];
      jest.mocked(axios).get.mockResolvedValueOnce({ data: streamSet });

      const api = new StravaApi();
      const result = await api.getActivityStream('access_token', '1');

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "data": [
              [
                1,
                1,
              ],
              [
                2,
                2,
              ],
            ],
            "original_size": 2,
            "resolution": "low",
            "series_type": "distance",
            "type": "latlng",
          },
        ]
      `);
      expect(axios.get).toBeCalledTimes(1);
      expect(axios.get).toBeCalledWith(
        'https://www.strava.com/api/v3/activities/1/streams?keys=time,latlng,altitude&key_by_type=true',
        {
          headers: { Authorization: 'Bearer access_token' },
        },
      );
    });
  });

  describe('requestSubscriptionCreation', () => {
    it('calls strava API', async () => {
      const subscription: Subscription = {
        id: 123,
        application_id: 1234,
        callback_url: 'http://redirect.to',
        created_at: '2022-01-01T00:00:01Z',
        updated_at: '2022-01-01T00:00:01Z',
      };
      jest.mocked(axios).post.mockResolvedValueOnce({ data: subscription });

      const api = new StravaApi();
      const result = await api.requestSubscriptionCreation('http://redirect.to', 'verify_token');

      expect(result).toMatchInlineSnapshot(`
        {
          "application_id": 1234,
          "callback_url": "http://redirect.to",
          "created_at": "2022-01-01T00:00:01Z",
          "id": 123,
          "updated_at": "2022-01-01T00:00:01Z",
        }
      `);
      expect(axios.post).toBeCalledTimes(1);
      expect(axios.post).toBeCalledWith(
        'https://www.strava.com/api/v3/push_subscriptions',
        expect.any(FormData),
        expect.anything(),
      );
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const mockFormDataInstance = jest.mocked(FormData).mock.instances[0]!;
      expect(mockFormDataInstance.append).toBeCalledTimes(4);
      expect(mockFormDataInstance.append).nthCalledWith(3, 'callback_url', 'http://redirect.to');
      expect(mockFormDataInstance.append).nthCalledWith(4, 'verify_token', 'verify_token');
    });
  });

  describe('getSubscriptions', () => {
    it('calls strava API', async () => {
      const subscriptions: Subscription[] = [
        {
          id: 123,
          application_id: 1234,
          callback_url: 'http://redirect.to',
          created_at: '2022-01-01T00:00:01Z',
          updated_at: '2022-01-01T00:00:01Z',
        },
      ];
      jest.mocked(axios).get.mockResolvedValueOnce({ data: subscriptions });

      const api = new StravaApi();
      const result = await api.getSubscriptions();

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "application_id": 1234,
            "callback_url": "http://redirect.to",
            "created_at": "2022-01-01T00:00:01Z",
            "id": 123,
            "updated_at": "2022-01-01T00:00:01Z",
          },
        ]
      `);
      expect(axios.get).toBeCalledTimes(1);
      expect(axios.get).toBeCalledWith('https://www.strava.com/api/v3/push_subscriptions', expect.anything());
    });
  });

  describe('deleteSubscription', () => {
    it('calls strava API', async () => {
      jest.mocked(axios).delete.mockImplementation(() => Promise.resolve());

      const api = new StravaApi();
      await api.deleteSubscription('123');

      expect(axios.delete).toBeCalledTimes(1);
      expect(axios.delete).toBeCalledWith('https://www.strava.com/api/v3/push_subscriptions/123', expect.anything());
    });
  });
});