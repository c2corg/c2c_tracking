import { beforeEach, describe, expect, it, vi } from 'vitest';

import { http, HttpError } from '../../../../src/helpers/http.ts';
import log from '../../../../src/helpers/logger.ts';
import { promApiErrorsCounter } from '../../../../src/metrics/prometheus.ts';
import type {
  Activity,
  StravaAuth,
  StravaRefreshAuth,
  StreamSet,
  Subscription,
} from '../../../../src/server/strava/strava.api.ts';
import { StravaApi } from '../../../../src/server/strava/strava.api.ts';
import { respond } from '../../../utils.ts';

// the HTTP calls are mocked, not the errors
vi.mock('../../../../src/helpers/http.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  http: { get: vi.fn(), post: vi.fn(), postForm: vi.fn(), delete: vi.fn() },
}));

describe('Strava API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exchangeToken', () => {
    it('calls strava API', async () => {
      const auth: StravaAuth = {
        athlete: { id: 1 },
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: 1,
        expires_in: 1,
      };
      vi.mocked(http).post.mockResolvedValueOnce(respond(auth));

      const api = new StravaApi();
      const result = await api.exchangeToken('code');

      expect(http.post).toHaveBeenCalledTimes(1);
      expect(http.post).toHaveBeenCalledWith('https://www.strava.com/api/v3/oauth/token', null, {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        params: expect.objectContaining({ code: 'code' }),
      });
      expect(result).toMatchObject({
        access_token: 'access_token',
        athlete: {
          id: 1,
        },
        expires_at: 1,
        expires_in: 1,
        refresh_token: 'refresh_token',
      });
    });
  });

  describe('deauthorize', () => {
    it('calls strava API', async () => {
      vi.mocked(http).post.mockResolvedValueOnce(respond());

      const api = new StravaApi();
      await api.deauthorize('token');

      expect(http.post).toHaveBeenCalledTimes(1);
      expect(http.post).toHaveBeenCalledWith('https://www.strava.com/oauth/revoke', null, {
        params: { token: 'token' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        auth: expect.objectContaining({ username: expect.any(String), password: expect.any(String) }),
      });
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
      vi.mocked(http).post.mockResolvedValueOnce(respond(refreshAuth));

      const api = new StravaApi();
      const result = await api.refreshAuth('refresh_token');

      expect(result).toMatchObject({
        access_token: 'access_token',
        expires_at: 1,
        expires_in: 1,
        refresh_token: 'refresh_token',
      });
      expect(http.post).toHaveBeenCalledTimes(1);
      expect(http.post).toHaveBeenCalledWith('https://www.strava.com/api/v3/oauth/token', null, {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
          sport_type: 'Run',
          start_date: '2022-01-01T00:00:01Z',
          start_date_local: '2022-01-01T01:00:01Z',
          distance: 1.2,
          elapsed_time: 1,
          total_elevation_gain: 1.2,
        },
      ];
      vi.mocked(http).get.mockResolvedValueOnce(respond(activities));

      const api = new StravaApi();
      const result = await api.getAthleteActivities('access_token');

      expect(result).toMatchObject([
        {
          distance: 1.2,
          elapsed_time: 1,
          id: 123,
          name: 'Afternoon Run',
          sport_type: 'Run',
          start_date: '2022-01-01T00:00:01Z',
          start_date_local: '2022-01-01T01:00:01Z',
          total_elevation_gain: 1.2,
        },
      ]);
      expect(http.get).toHaveBeenCalledTimes(1);
      expect(http.get).toHaveBeenCalledWith('https://www.strava.com/api/v3/athlete/activities', {
        headers: { Authorization: 'Bearer access_token' },
      });
    });
  });

  describe('getActivity', () => {
    it('calls strava API', async () => {
      const activity: Activity = {
        id: 123,
        name: 'Afternoon Run',
        sport_type: 'Run',
        start_date: '2022-01-01T00:00:01Z',
        start_date_local: '2022-01-01T00:00:01Z',
        distance: 1.2,
        elapsed_time: 1,
        total_elevation_gain: 1.2,
      };
      vi.mocked(http).get.mockResolvedValueOnce(respond(activity));

      const api = new StravaApi();
      const result = await api.getActivity('access_token', 123);

      expect(result).toMatchObject({
        distance: 1.2,
        elapsed_time: 1,
        id: 123,
        name: 'Afternoon Run',
        sport_type: 'Run',
        start_date: '2022-01-01T00:00:01Z',
        start_date_local: '2022-01-01T00:00:01Z',
        total_elevation_gain: 1.2,
      });
      expect(http.get).toHaveBeenCalledTimes(1);
      expect(http.get).toHaveBeenCalledWith('https://www.strava.com/api/v3/activities/123', {
        headers: { Authorization: 'Bearer access_token' },
      });
    });
  });

  describe('getActivityStream', () => {
    it('calls strava API', async () => {
      const streamSet: StreamSet = {
        latlng: {
          series_type: 'distance',
          original_size: 2,
          resolution: 'low',
          data: [
            [1.0, 1.0],
            [2.0, 2.0],
          ],
        },
      };
      vi.mocked(http).get.mockResolvedValueOnce(respond(streamSet));

      const api = new StravaApi();
      const result = await api.getActivityStream('access_token', 1);

      expect(result).toMatchObject({
        latlng: {
          data: [
            [1, 1],
            [2, 2],
          ],
          original_size: 2,
          resolution: 'low',
          series_type: 'distance',
        },
      });
      expect(http.get).toHaveBeenCalledTimes(1);
      expect(http.get).toHaveBeenCalledWith('https://www.strava.com/api/v3/activities/1/streams', {
        headers: { Authorization: 'Bearer access_token' },
        params: { keys: 'distance,time,latlng,altitude', key_by_type: true },
      });
    });

    it('gives nothing, without warning nor API error count, for an activity without GPS track (404)', async () => {
      const warn = vi.spyOn(log, 'warn').mockImplementation(() => undefined);
      const errors = vi.spyOn(promApiErrorsCounter, 'labels');
      vi.mocked(http).get.mockRejectedValueOnce(
        new HttpError('Request failed with status code 404', { method: 'GET', url: 'https://strava' }, { status: 404 }),
      );

      const api = new StravaApi();

      await expect(api.getActivityStream('access_token', 1)).resolves.toBeUndefined();
      expect(warn).not.toHaveBeenCalled();
      expect(errors).not.toHaveBeenCalled();
    });

    it('still fails on other errors', async () => {
      vi.spyOn(log, 'warn').mockImplementation(() => undefined);
      vi.mocked(http).get.mockRejectedValueOnce(
        new HttpError('Request failed with status code 401', { method: 'GET', url: 'https://strava' }, { status: 401 }),
      );

      const api = new StravaApi();

      await expect(api.getActivityStream('access_token', 1)).rejects.toThrow(
        'Error on Strava getActivityStream request',
      );
    });
  });

  describe('requestSubscriptionCreation', () => {
    it('calls strava API', async () => {
      vi.mocked(http).post.mockResolvedValueOnce(respond({ id: 123 }));

      const api = new StravaApi();
      const result = await api.requestSubscriptionCreation('http://redirect.to', 'verify_token');

      expect(result).toEqual(123);
      expect(http.post).toHaveBeenCalledTimes(1);
      const [url, body] = vi.mocked(http).post.mock.calls[0]!;
      expect(url).toEqual('https://www.strava.com/api/v3/push_subscriptions');
      expect(body).toBeInstanceOf(URLSearchParams);
      expect(Object.fromEntries(body as URLSearchParams)).toEqual({
        client_id: '63968',
        client_secret: 'd37d09886c3a92ced03feca580ccecd5630559ec',
        callback_url: 'http://redirect.to',
        verify_token: 'verify_token',
      });
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
      vi.mocked(http).get.mockResolvedValueOnce(respond(subscriptions));

      const api = new StravaApi();
      const result = await api.getSubscriptions();

      expect(result).toMatchObject([
        {
          application_id: 1234,
          callback_url: 'http://redirect.to',
          created_at: '2022-01-01T00:00:01Z',
          id: 123,
          updated_at: '2022-01-01T00:00:01Z',
        },
      ]);
      expect(http.get).toHaveBeenCalledTimes(1);
      expect(http.get).toHaveBeenCalledWith('https://www.strava.com/api/v3/push_subscriptions', expect.anything());
    });
  });

  describe('deleteSubscription', () => {
    it('calls strava API', async () => {
      vi.mocked(http).delete.mockResolvedValue(respond());

      const api = new StravaApi();
      await api.deleteSubscription('123');

      expect(http.delete).toHaveBeenCalledTimes(1);
      expect(http.delete).toHaveBeenCalledWith(
        'https://www.strava.com/api/v3/push_subscriptions/123',
        expect.anything(),
      );
    });
  });
});
