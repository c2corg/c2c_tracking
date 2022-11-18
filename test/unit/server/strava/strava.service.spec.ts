import polyline from '@mapbox/polyline';

import log from '../../../../src/helpers/logger';
import { activityRepository } from '../../../../src/repository/activity.repository';
import { stravaRepository } from '../../../../src/repository/strava.repository';
import { userRepository } from '../../../../src/repository/user.repository';
import { stravaApi } from '../../../../src/server/strava/strava.api';
import { stravaService, StravaService } from '../../../../src/server/strava/strava.service';
import { userService } from '../../../../src/user.service';

jest.mock('@mapbox/polyline');

describe('Strava Service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(log, 'info').mockImplementation(() => Promise.resolve());
    jest.spyOn(log, 'warn').mockImplementation(() => Promise.resolve());
  });

  describe('containsRequiredScopes', () => {
    it('check scopes', () => {
      const service = new StravaService();

      expect(service.containsRequiredScopes([])).toBeFalsy();
      expect(service.containsRequiredScopes(['toto'])).toBeFalsy();
      expect(service.containsRequiredScopes(['activity:read'])).toBeTruthy();
      expect(service.containsRequiredScopes(['toto', 'activity:read_all'])).toBeTruthy();
      expect(service.containsRequiredScopes(['activity:read', 'activity:read_all'])).toBeTruthy();
    });
  });

  describe('requestShortLivedAccessTokenAndSetupUser', () => {
    it('calls API then setups user', async () => {
      jest.spyOn(stravaApi, 'exchangeToken').mockResolvedValueOnce({
        athlete: { id: 1 },
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: 1,
        expires_in: 1,
      });
      jest.spyOn(userService, 'configureStrava').mockResolvedValueOnce(undefined);
      jest.spyOn(stravaApi, 'getAthleteActivities').mockResolvedValueOnce([
        {
          id: 1,
          name: 'Morning run',
          sport_type: 'Run',
          start_date: '2022-01-01T00:00:01Z',
          start_date_local: '2022-01-01T01:00:01Z',
          distance: 1.2,
          elapsed_time: 1,
          total_elevation_gain: 1.2,
          map: { summary_polyline: 'polyline' },
        },
      ]);
      jest.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

      const service = new StravaService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(stravaApi.exchangeToken).toBeCalledTimes(1);
      expect(stravaApi.exchangeToken).toBeCalledWith('code');
      expect(userService.configureStrava).toBeCalledTimes(1);
      expect(userService.configureStrava).toBeCalledWith(1, {
        athlete: { id: 1 },
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: 1,
        expires_in: 1,
      });
      expect(stravaApi.getAthleteActivities).toBeCalledTimes(1);
      expect(stravaApi.getAthleteActivities).toBeCalledWith('access_token');
      expect(userService.addActivities).toBeCalledTimes(1);
      expect(userService.addActivities).toBeCalledWith(1, {
        vendor: 'strava',
        vendorId: '1',
        name: 'Morning run',
        type: 'Run',
        date: '2022-01-01T01:00:01+01:00',
        length: 1,
        duration: 1,
        heightDiffUp: 1,
      });
    });

    it('stores activities only if there are some', async () => {
      jest.spyOn(stravaApi, 'exchangeToken').mockResolvedValueOnce({
        athlete: { id: 1 },
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: 1,
        expires_in: 1,
      });
      jest.spyOn(userService, 'configureStrava').mockResolvedValueOnce(undefined);
      jest.spyOn(stravaApi, 'getAthleteActivities').mockResolvedValueOnce([]);
      jest.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

      const service = new StravaService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(userService.configureStrava).toBeCalledTimes(1);
      expect(stravaApi.getAthleteActivities).toBeCalledTimes(1);
      expect(userService.addActivities).not.toBeCalled();
    });

    it('throws if auth cannot be configured', async () => {
      jest.spyOn(stravaApi, 'exchangeToken').mockResolvedValueOnce({
        athlete: { id: 1 },
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: 1,
        expires_in: 1,
      });
      jest.spyOn(userService, 'configureStrava').mockRejectedValueOnce(new Error('test'));
      jest.spyOn(stravaApi, 'getAthleteActivities');

      const service = new StravaService();
      await expect(
        service.requestShortLivedAccessTokenAndSetupUser(1, 'code'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"test"`);

      expect(userService.configureStrava).toBeCalledTimes(1);
      expect(stravaApi.getAthleteActivities).not.toBeCalled();
    });

    it('logs if activity retrieval fails', async () => {
      jest.spyOn(stravaApi, 'exchangeToken').mockResolvedValueOnce({
        athlete: { id: 1 },
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: 1,
        expires_in: 1,
      });
      jest.spyOn(userService, 'configureStrava').mockResolvedValueOnce(undefined);
      jest.spyOn(stravaApi, 'getAthleteActivities').mockRejectedValueOnce(undefined);
      jest.spyOn(userService, 'addActivities');

      const service = new StravaService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(stravaApi.getAthleteActivities).toBeCalledTimes(1);
      expect(userService.addActivities).not.toBeCalled();
    });
  });

  describe('deauthorize', () => {
    it('throws if no matching user is found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userService, 'getStravaInfo');

      const service = new StravaService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(`"User 1 not found"`);

      expect(userService.getStravaInfo).not.toBeCalled();
    });

    it('throws if no matching auth exists for user', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userService, 'getStravaInfo').mockResolvedValueOnce(undefined);
      jest.spyOn(userService, 'clearStravaTokens').mockResolvedValueOnce(undefined);

      const service = new StravaService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Unable to retrieve token for user 1"`,
      );

      expect(userService.getStravaInfo).toBeCalledTimes(1);
      expect(userService.getStravaInfo).toBeCalledWith(1);
      expect(userService.clearStravaTokens).toBeCalledTimes(1);
    });

    it('calls strava API then updates DB', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userService, 'getStravaInfo').mockResolvedValueOnce({
        id: 1,
        accessToken: 'access_token',
        refreshToken: 'refreshSecret',
        expiresAt: 99999999999,
      });
      jest.spyOn(stravaApi, 'deauthorize').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new StravaService();
      await service.deauthorize(1);

      expect(userService.getStravaInfo).toBeCalledTimes(1);
      expect(userService.getStravaInfo).toBeCalledWith(1);
      expect(stravaApi.deauthorize).toBeCalledTimes(1);
      expect(stravaApi.deauthorize).toBeCalledWith('access_token');
      expect(activityRepository.deleteByUserAndVendor).toBeCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toBeCalledWith(1, 'strava');
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith(expect.not.objectContaining({ strava: expect.anything() }));
    });
  });

  describe('getToken', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('1970-01-01T00:00:01Z') });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns access_token if still valid for 1 minute', async () => {
      jest.spyOn(userService, 'getStravaInfo').mockResolvedValueOnce({
        id: 1,
        accessToken: 'access_token',
        refreshToken: 'refreshSecret',
        expiresAt: 62,
      });
      jest.spyOn(stravaApi, 'refreshAuth');

      const service = new StravaService();
      const result = await service.getToken(1);

      expect(result).toBe('access_token');
      expect(userService.getStravaInfo).toBeCalledTimes(1);
      expect(userService.getStravaInfo).toBeCalledWith(1);
    });

    it('retrieves a new access token if current one is expired', async () => {
      jest.spyOn(userService, 'getStravaInfo').mockResolvedValueOnce({
        id: 1,
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: 61,
      });
      jest.spyOn(stravaApi, 'refreshAuth').mockResolvedValueOnce({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_at: 3600,
        expires_in: 3540,
      });
      jest.spyOn(userService, 'updateStravaAuth').mockImplementationOnce(() => Promise.resolve());

      const service = new StravaService();
      const result = await service.getToken(1);

      expect(result).toBe('new_access_token');
      expect(stravaApi.refreshAuth).toBeCalledTimes(1);
      expect(stravaApi.refreshAuth).toBeCalledWith('refresh_token');
      expect(userService.updateStravaAuth).toBeCalledTimes(1);
      expect(userService.updateStravaAuth).toBeCalledWith(1, {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_at: 3600,
        expires_in: 3540,
      });
    });

    it('returns undefined if refresh fails', async () => {
      jest.spyOn(userService, 'getStravaInfo').mockResolvedValueOnce({
        id: 1,
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: 61,
      });
      jest.spyOn(stravaApi, 'refreshAuth').mockRejectedValueOnce(undefined);
      jest.spyOn(userService, 'clearStravaTokens').mockResolvedValueOnce(undefined);

      const service = new StravaService();
      const result = await service.getToken(1);

      expect(result).toBeUndefined();
      expect(stravaApi.refreshAuth).toBeCalledTimes(1);
      expect(stravaApi.refreshAuth).toBeCalledWith('refresh_token');
      expect(userService.clearStravaTokens).toBeCalledTimes(1);
    });
  });

  describe('getActivityLine', () => {
    it('calls strava API', async () => {
      jest.spyOn(stravaApi, 'getActivity').mockResolvedValueOnce({
        id: 1,
        name: 'Morning Run',
        sport_type: 'Run',
        start_date: '1970-01-01T00:00:01Z',
        start_date_local: '1970-01-01T00:00:01Z',
        distance: 1.2,
        elapsed_time: 1,
        total_elevation_gain: 1.2,
        map: {
          summary_polyline: 'poyline',
        },
      });
      jest
        .mocked(polyline)
        .toGeoJSON.mockResolvedValue({ type: 'LineString', coordinates: [[1.0, 1.0, 200]] } as never); // why is cast to never needed? no clue...

      const service = new StravaService();
      const result = await service.getActivityLine('access_token', '1');

      expect(result).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              1,
              1,
              200,
            ],
          ],
          "type": "LineString",
        }
      `);
    });
  });

  describe('getActivityStream', () => {
    it('calls strava API', async () => {
      jest.spyOn(stravaApi, 'getActivityStream').mockResolvedValueOnce([
        {
          type: 'distance',
          series_type: 'distance',
          resolution: 'low',
          original_size: 1,
          data: [1.0],
        },
      ]);

      const service = new StravaService();
      const result = await service.getActivityStream('access_token', '1');

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "data": [
              1,
            ],
            "original_size": 1,
            "resolution": "low",
            "series_type": "distance",
            "type": "distance",
          },
        ]
      `);
    });
  });

  describe('setupWebhook', () => {
    it('handles existing subscription', async () => {
      jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
      jest.spyOn(stravaApi, 'getSubscriptions').mockResolvedValueOnce([
        {
          id: 1,
          application_id: 1,
          created_at: '1970-01-01T00:00:01Z',
          updated_at: '1970-01-01T00:00:01Z',
          callback_url: 'http://localhost:3000/strava/webhook',
        },
      ]);
      jest.spyOn(stravaApi, 'requestSubscriptionCreation');

      const service = new StravaService();
      await service.setupWebhook();

      expect(stravaRepository.findSubscription).toBeCalledTimes(1);
      expect(stravaApi.getSubscriptions).toBeCalledTimes(1);
      expect(stravaApi.requestSubscriptionCreation).not.toBeCalled();
      expect(log.info).toBeCalledTimes(1);
      expect(log.info).toBeCalledWith('Found matching Strava webhook subscription');
    });

    it('handles no subscription', async () => {
      jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(undefined);
      jest.spyOn(stravaApi, 'getSubscriptions');
      const requestWebhookSpy = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(StravaService.prototype as any, 'requestWebhookSubscription')
        .mockImplementationOnce(() => Promise.resolve());

      const service = new StravaService();
      await service.setupWebhook();

      expect(stravaRepository.findSubscription).toBeCalledTimes(1);
      expect(stravaApi.getSubscriptions).not.toBeCalled();
      expect(log.info).toBeCalledTimes(1);
      expect(log.info).toBeCalledWith('No Strava webhook subscription found in DB');
      expect(requestWebhookSpy).toBeCalledTimes(1);

      requestWebhookSpy.mockRestore();
    });

    it('handles subscription check error', async () => {
      jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
      jest.spyOn(stravaApi, 'getSubscriptions').mockRejectedValueOnce(undefined);
      const requestWebhookSpy = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(StravaService.prototype as any, 'requestWebhookSubscription')
        .mockImplementationOnce(() => Promise.resolve());

      const service = new StravaService();
      await service.setupWebhook();

      expect(stravaRepository.findSubscription).toBeCalledTimes(1);
      expect(stravaApi.getSubscriptions).toBeCalledTimes(1);
      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
        `Strava webhook subscription status couldn't be checked: unable to retrieve current subscription. Assuming not set`,
      );
      expect(requestWebhookSpy).toBeCalledTimes(1);

      requestWebhookSpy.mockRestore();
    });

    it('handles not matching strava subscription', async () => {
      jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
      jest.spyOn(stravaApi, 'getSubscriptions').mockResolvedValueOnce([
        {
          id: 1,
          application_id: 1,
          created_at: '1970-01-01T00:00:01Z',
          updated_at: '1970-01-01T00:00:01Z',
          callback_url: 'not a matching url',
        },
      ]);
      const requestWebhookSpy = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(StravaService.prototype as any, 'requestWebhookSubscription')
        .mockImplementationOnce(() => Promise.resolve());

      const service = new StravaService();
      await service.setupWebhook();

      expect(stravaRepository.findSubscription).toBeCalledTimes(1);
      expect(stravaApi.getSubscriptions).toBeCalledTimes(1);
      expect(log.info).toBeCalledTimes(1);
      expect(log.info).toBeCalledWith('No matching Strava webhook subscription found');
      expect(requestWebhookSpy).toBeCalledTimes(1);

      requestWebhookSpy.mockRestore();
    });

    it('logs if subscription cannot be created', async () => {
      jest.spyOn(stravaApi, 'requestSubscriptionCreation').mockRejectedValueOnce(undefined);
      jest.spyOn(stravaRepository, 'setSubscription');

      const service = new StravaService();
      await service['requestWebhookSubscription']();

      expect(stravaApi.requestSubscriptionCreation).toBeCalledTimes(1);
      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
        `Strava subscription couldn't be requested, maybe another webhook is already registered`,
      );
      expect(stravaRepository.setSubscription).not.toBeCalled();
    });

    it('logs if subscription cannot be stored in DB', async () => {
      jest.spyOn(stravaApi, 'requestSubscriptionCreation').mockResolvedValueOnce(1);
      jest.spyOn(stravaRepository, 'setSubscription').mockRejectedValueOnce(undefined);

      const service = new StravaService();
      await service['requestWebhookSubscription']();

      expect(stravaApi.requestSubscriptionCreation).toBeCalledTimes(1);
      expect(stravaRepository.setSubscription).toBeCalledTimes(1);
      expect(stravaRepository.setSubscription).toBeCalledWith(1);
      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(`Strava subscription couldn't be stored in DB`);
    });

    it('creates new subscription', async () => {
      jest.spyOn(stravaApi, 'requestSubscriptionCreation').mockResolvedValueOnce(1);
      jest.spyOn(stravaRepository, 'setSubscription').mockResolvedValueOnce(undefined);

      const service = new StravaService();
      await service['requestWebhookSubscription']();

      expect(stravaApi.requestSubscriptionCreation).toBeCalledTimes(1);
      expect(stravaRepository.setSubscription).toBeCalledTimes(1);
      expect(stravaRepository.setSubscription).toBeCalledWith(1);
    });
  });

  describe('handleWebhookEvent', () => {
    it('handles invalid event', async () => {
      jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(9);

      const service = new StravaService();
      await service.handleWebhookEvent({
        subscription_id: 1,
        object_id: 1,
        object_type: 'activity',
        aspect_type: 'update',
        owner_id: 1,
        event_time: 1,
        updates: {},
      });

      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(`Invalid webhook event: subscription id 1 doesn't match`);
    });

    it('ignores undesired events', async () => {
      jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);

      const service = new StravaService();
      await service.handleWebhookEvent({
        subscription_id: 1,
        object_id: 1,
        object_type: 'athlete',
        aspect_type: 'update',
        owner_id: 1,
        event_time: 1,
        updates: {},
      });

      expect(log.info).toBeCalledTimes(1);
      expect(log.info).toBeCalledWith(`Not handling event athlete/update`);
    });

    describe('athlete delete event', () => {
      it('ignores if user does not match', async () => {
        jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        jest.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce(undefined);

        const service = new StravaService();
        await service.handleWebhookEvent({
          subscription_id: 1,
          object_id: 1,
          object_type: 'athlete',
          aspect_type: 'delete',
          owner_id: 1,
          event_time: 1,
          updates: { authorized: 'false' },
        });

        expect(log.warn).toBeCalledTimes(1);
        expect(log.warn).toBeCalledWith(
          `Strava athlete deletion webhook event for Strava user 1 couldn't be processed: unable to find matching user in DB`,
        );
      });

      it('clears user strava data', async () => {
        jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        jest.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({
          c2cId: 1,
          strava: {
            accessToken: 'access_token',
            refreshToken: 'refresh_token',
            id: 1,
            expiresAt: 1,
          },
        });
        jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
        jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

        const service = new StravaService();
        await service.handleWebhookEvent({
          subscription_id: 1,
          object_id: 1,
          object_type: 'athlete',
          aspect_type: 'delete',
          owner_id: 1,
          event_time: 1,
          updates: { authorized: 'false' },
        });

        expect(activityRepository.deleteByUserAndVendor).toBeCalledTimes(1);
        expect(activityRepository.deleteByUserAndVendor).toBeCalledWith(1, 'strava');
        expect(userRepository.update).toBeCalledTimes(1);
        expect(userRepository.update).toBeCalledWith({ c2cId: 1 });
      });
    });

    describe('activity create event', () => {
      it('logs if user does not match', async () => {
        jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        jest.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce(undefined);

        const service = new StravaService();
        await service.handleWebhookEvent({
          subscription_id: 1,
          object_id: 1,
          object_type: 'activity',
          aspect_type: 'create',
          owner_id: 1,
          event_time: 1,
          updates: {},
        });

        expect(log.warn).toBeCalledTimes(1);
        expect(log.warn).toBeCalledWith(
          `Strava activity creation webhook event for Strava user 1 couldn't be processed: unable to find matching user in DB`,
        );
      });

      it('logs if access token cannot be retrieved', async () => {
        jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        jest.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({ c2cId: 1 });
        const getTokenSpy = jest
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(StravaService.prototype as any, 'getToken')
          .mockImplementationOnce(() => Promise.resolve(undefined));

        const service = new StravaService();
        await service.handleWebhookEvent({
          subscription_id: 1,
          object_id: 1,
          object_type: 'activity',
          aspect_type: 'create',
          owner_id: 1,
          event_time: 1,
          updates: {},
        });

        expect(stravaService.getToken).toBeCalledTimes(1);
        expect(log.warn).toBeCalledTimes(1);
        expect(log.warn).toBeCalledWith(
          `Strava activity creation webhook event for user 1 couldn't be processed: unable to acquire valid token`,
        );

        getTokenSpy.mockRestore();
      });

      it('logs if activity cannot be retrieved', async () => {
        jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        jest.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({ c2cId: 1 });
        const getTokenSpy = jest
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(StravaService.prototype as any, 'getToken')
          .mockImplementationOnce(() => Promise.resolve('access_token'));
        jest.spyOn(stravaApi, 'getActivity').mockRejectedValueOnce(undefined);
        jest.spyOn(userService, 'addActivities');

        const service = new StravaService();
        await service.handleWebhookEvent({
          subscription_id: 1,
          object_id: 1,
          object_type: 'activity',
          aspect_type: 'create',
          owner_id: 1,
          event_time: 1,
          updates: {},
        });

        expect(stravaService.getToken).toBeCalledTimes(1);
        expect(stravaApi.getActivity).toBeCalledTimes(1);
        expect(stravaApi.getActivity).toBeCalledWith('access_token', '1');
        expect(log.warn).toBeCalledTimes(1);
        expect(log.warn).toBeCalledWith(
          `Strava activity creation webhook event for user 1 couldn't be processed: unable to retrieve activity data`,
        );
        expect(userService.addActivities).not.toBeCalled();

        getTokenSpy.mockRestore();
      });

      it('logs if activity cannot be saved to DB', async () => {
        jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        jest.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({ c2cId: 1 });
        const getTokenSpy = jest
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(StravaService.prototype as any, 'getToken')
          .mockImplementationOnce(() => Promise.resolve('access_token'));
        jest.spyOn(stravaApi, 'getActivity').mockResolvedValueOnce({
          id: 1,
          name: 'Morning Run',
          sport_type: 'Run',
          start_date: '1970-01-01T00:00:01Z',
          start_date_local: '1970-01-01T02:00:01Z',
          distance: 1.2,
          elapsed_time: 1,
          total_elevation_gain: 1.2,
          map: {
            summary_polyline: 'polyline',
          },
        });
        jest.spyOn(userService, 'addActivities').mockRejectedValueOnce(undefined);

        const service = new StravaService();
        await service.handleWebhookEvent({
          subscription_id: 1,
          object_id: 1,
          object_type: 'activity',
          aspect_type: 'create',
          owner_id: 1,
          event_time: 1,
          updates: {},
        });

        expect(stravaService.getToken).toBeCalledTimes(1);
        expect(stravaApi.getActivity).toBeCalledTimes(1);
        expect(stravaApi.getActivity).toBeCalledWith('access_token', '1');
        expect(userService.addActivities).toBeCalledTimes(1);
        expect(userService.addActivities).toBeCalledWith(1, {
          vendor: 'strava',
          vendorId: '1',
          date: '1970-01-01T02:00:01+02:00',
          name: 'Morning Run',
          type: 'Run',
          length: 1,
          duration: 1,
          heightDiffUp: 1,
        });
        expect(log.warn).toBeCalledTimes(1);
        expect(log.warn).toBeCalledWith(
          `Strava activity creation webhook event for user 1 couldn't be processed: unable to insert activity data`,
        );

        getTokenSpy.mockRestore();
      });

      it('adds activity to user', async () => {
        jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        jest.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({ c2cId: 1 });
        const getTokenSpy = jest
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(StravaService.prototype as any, 'getToken')
          .mockImplementationOnce(() => Promise.resolve('access_token'));
        jest.spyOn(stravaApi, 'getActivity').mockResolvedValueOnce({
          id: 1,
          name: 'Morning Run',
          sport_type: 'Run',
          start_date: '1970-01-01T00:00:01Z',
          start_date_local: '1970-01-01T00:00:01Z',
          distance: 1.2,
          elapsed_time: 1,
          total_elevation_gain: 1.2,
          map: {
            summary_polyline: 'polyline',
          },
        });
        jest.spyOn(userService, 'addActivities');

        const service = new StravaService();
        await service.handleWebhookEvent({
          subscription_id: 1,
          object_id: 1,
          object_type: 'activity',
          aspect_type: 'create',
          owner_id: 1,
          event_time: 1,
          updates: {},
        });

        expect(stravaService.getToken).toBeCalledTimes(1);
        expect(stravaApi.getActivity).toBeCalledTimes(1);
        expect(stravaApi.getActivity).toBeCalledWith('access_token', '1');
        expect(userService.addActivities).toBeCalledTimes(1);
        expect(userService.addActivities).toBeCalledWith(1, {
          vendor: 'strava',
          vendorId: '1',
          date: '1970-01-01T00:00:01Z',
          name: 'Morning Run',
          type: 'Run',
          length: 1,
          duration: 1,
          heightDiffUp: 1,
        });
        expect(log.warn).not.toBeCalled();

        getTokenSpy.mockRestore();
      });
    });

    describe('activity update event', () => {
      it('logs if user does not match', async () => {
        jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        jest.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce(undefined);

        const service = new StravaService();
        await service.handleWebhookEvent({
          subscription_id: 1,
          object_id: 1,
          object_type: 'activity',
          aspect_type: 'update',
          owner_id: 1,
          event_time: 1,
          updates: {},
        });

        expect(log.warn).toBeCalledTimes(1);
        expect(log.warn).toBeCalledWith(
          `Strava activity update webhook event for Strava user 1 couldn't be processed: unable to find matching user in DB`,
        );
      });

      it('logs if access token cannot be retrieved', async () => {
        jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        jest.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({ c2cId: 1 });
        const getTokenSpy = jest
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(StravaService.prototype as any, 'getToken')
          .mockImplementationOnce(() => Promise.resolve(undefined));

        const service = new StravaService();
        await service.handleWebhookEvent({
          subscription_id: 1,
          object_id: 1,
          object_type: 'activity',
          aspect_type: 'update',
          owner_id: 1,
          event_time: 1,
          updates: {},
        });

        expect(stravaService.getToken).toBeCalledTimes(1);
        expect(log.warn).toBeCalledTimes(1);
        expect(log.warn).toBeCalledWith(
          `Strava activity update webhook event for user 1 couldn't be processed: unable to acquire valid token`,
        );

        getTokenSpy.mockRestore();
      });

      it('logs if activity cannot be retrieved', async () => {
        jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        jest.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({ c2cId: 1 });
        const getTokenSpy = jest
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(StravaService.prototype as any, 'getToken')
          .mockImplementationOnce(() => Promise.resolve('access_token'));
        jest.spyOn(stravaApi, 'getActivity').mockRejectedValueOnce(undefined);
        jest.spyOn(userService, 'updateActivity');

        const service = new StravaService();
        await service.handleWebhookEvent({
          subscription_id: 1,
          object_id: 1,
          object_type: 'activity',
          aspect_type: 'update',
          owner_id: 1,
          event_time: 1,
          updates: {},
        });

        expect(stravaService.getToken).toBeCalledTimes(1);
        expect(stravaApi.getActivity).toBeCalledTimes(1);
        expect(stravaApi.getActivity).toBeCalledWith('access_token', '1');
        expect(log.warn).toBeCalledTimes(1);
        expect(log.warn).toBeCalledWith(
          `Strava activity update webhook event for user 1 couldn't be processed: unable to retrieve activity data`,
        );
        expect(userService.updateActivity).not.toBeCalled();

        getTokenSpy.mockRestore();
      });

      it('logs if activity cannot be saved to DB', async () => {
        jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        jest.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({ c2cId: 1 });
        const getTokenSpy = jest
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(StravaService.prototype as any, 'getToken')
          .mockImplementationOnce(() => Promise.resolve('access_token'));
        jest.spyOn(stravaApi, 'getActivity').mockResolvedValueOnce({
          id: 1,
          name: 'Morning Run',
          sport_type: 'Run',
          start_date: '1970-01-01T00:00:01Z',
          start_date_local: '1970-01-01T00:00:01Z',
          distance: 1.2,
          elapsed_time: 1,
          total_elevation_gain: 1.2,
          map: {
            summary_polyline: 'polyline',
          },
        });
        jest.spyOn(userService, 'updateActivity').mockRejectedValueOnce(undefined);

        const service = new StravaService();
        await service.handleWebhookEvent({
          subscription_id: 1,
          object_id: 1,
          object_type: 'activity',
          aspect_type: 'update',
          owner_id: 1,
          event_time: 1,
          updates: {},
        });

        expect(stravaService.getToken).toBeCalledTimes(1);
        expect(stravaApi.getActivity).toBeCalledTimes(1);
        expect(stravaApi.getActivity).toBeCalledWith('access_token', '1');
        expect(userService.updateActivity).toBeCalledTimes(1);
        expect(userService.updateActivity).toBeCalledWith(1, {
          vendor: 'strava',
          vendorId: '1',
          date: '1970-01-01T00:00:01Z',
          name: 'Morning Run',
          type: 'Run',
          length: 1,
          duration: 1,
          heightDiffUp: 1,
        });
        expect(log.warn).toBeCalledTimes(1);
        expect(log.warn).toBeCalledWith(
          `Strava activity update webhook event for user 1 couldn't be processed: unable to update activity data in DB`,
        );

        getTokenSpy.mockRestore();
      });

      it('updates user activity', async () => {
        jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        jest.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({ c2cId: 1 });
        const getTokenSpy = jest
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(StravaService.prototype as any, 'getToken')
          .mockImplementationOnce(() => Promise.resolve('access_token'));
        jest.spyOn(stravaApi, 'getActivity').mockResolvedValueOnce({
          id: 1,
          name: 'Morning Run',
          sport_type: 'Run',
          start_date: '1970-01-01T00:00:01Z',
          start_date_local: '1970-01-01T00:00:01Z',
          distance: 1.2,
          elapsed_time: 1,
          total_elevation_gain: 1.2,
          map: {
            summary_polyline: 'polyline',
          },
        });
        jest.spyOn(userService, 'updateActivity');

        const service = new StravaService();
        await service.handleWebhookEvent({
          subscription_id: 1,
          object_id: 1,
          object_type: 'activity',
          aspect_type: 'update',
          owner_id: 1,
          event_time: 1,
          updates: {},
        });

        expect(stravaService.getToken).toBeCalledTimes(1);
        expect(stravaApi.getActivity).toBeCalledTimes(1);
        expect(stravaApi.getActivity).toBeCalledWith('access_token', '1');
        expect(userService.updateActivity).toBeCalledTimes(1);
        expect(userService.updateActivity).toBeCalledWith(1, {
          vendor: 'strava',
          vendorId: '1',
          date: '1970-01-01T00:00:01Z',
          name: 'Morning Run',
          type: 'Run',
          length: 1,
          duration: 1,
          heightDiffUp: 1,
        });
        expect(log.warn).not.toBeCalled();

        getTokenSpy.mockRestore();
      });
    });

    describe('activity delete event', () => {
      it('logs if activity could not be deleted', async () => {
        jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        jest.spyOn(userService, 'deleteActivity').mockRejectedValueOnce(undefined);

        const service = new StravaService();
        await service.handleWebhookEvent({
          subscription_id: 1,
          object_id: 1,
          object_type: 'activity',
          aspect_type: 'delete',
          owner_id: 1,
          event_time: 1,
          updates: {},
        });

        expect(userService.deleteActivity).toBeCalledTimes(1);
        expect(userService.deleteActivity).toBeCalledWith('strava', '1');
        expect(log.warn).toBeCalledTimes(1);
        expect(log.warn).toBeCalledWith(
          `Strava activity delete webhook event for activity 1 couldn't be processed: unable to delete activity data in DB`,
        );
      });

      it('deletes activity', async () => {
        jest.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        jest.spyOn(userService, 'deleteActivity').mockResolvedValueOnce(undefined);

        const service = new StravaService();
        await service.handleWebhookEvent({
          subscription_id: 1,
          object_id: 1,
          object_type: 'activity',
          aspect_type: 'delete',
          owner_id: 1,
          event_time: 1,
          updates: {},
        });

        expect(userService.deleteActivity).toBeCalledTimes(1);
        expect(userService.deleteActivity).toBeCalledWith('strava', '1');
        expect(log.warn).not.toBeCalled();
      });
    });
  });
});
