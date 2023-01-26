import log from '../../../../src/helpers/logger';
import { activityRepository } from '../../../../src/repository/activity.repository';
import { userRepository } from '../../../../src/repository/user.repository';
import { decathlonApi } from '../../../../src/server/decathlon/decathlon.api';
import { DecathlonService } from '../../../../src/server/decathlon/decathlon.service';
import { userService } from '../../../../src/user.service';

describe('Decathlon Service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(log, 'info').mockImplementation(() => Promise.resolve());
    jest.spyOn(log, 'warn').mockImplementation(() => Promise.resolve());
  });

  describe('requestShortLivedAccessTokenAndSetupUser', () => {
    it('calls API then setups user', async () => {
      jest.spyOn(decathlonApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
      });
      jest.spyOn(decathlonApi, 'getUserId').mockResolvedValueOnce('userId');
      jest.spyOn(decathlonApi, 'getExistingWebhookSubscription').mockResolvedValueOnce(undefined);
      jest.spyOn(decathlonApi, 'createWebhookSubscription').mockResolvedValueOnce('webhookId');
      jest.spyOn(userService, 'configureDecathlon').mockResolvedValueOnce(undefined);
      jest.spyOn(decathlonApi, 'getActivities').mockResolvedValueOnce([
        {
          id: '1',
          name: 'Morning run',
          sport: '/v2/sports/381',
          startdate: '2022-01-01T00:00:01Z',
          dataSummaries: { '18': 1.2, '5': 1.2, '24': 1.2 },
        },
      ]);
      jest.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

      const service = new DecathlonService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(decathlonApi.exchangeToken).toBeCalledTimes(1);
      expect(decathlonApi.exchangeToken).toBeCalledWith('code');
      expect(decathlonApi.getUserId).toBeCalledTimes(1);
      expect(decathlonApi.getUserId).toBeCalledWith('access_token');
      expect(decathlonApi.getExistingWebhookSubscription).toBeCalledTimes(1);
      expect(decathlonApi.getExistingWebhookSubscription).toBeCalledWith('access_token');
      expect(decathlonApi.createWebhookSubscription).toBeCalledTimes(1);
      expect(decathlonApi.createWebhookSubscription).toBeCalledWith('userId', 'access_token');
      expect(userService.configureDecathlon).toBeCalledTimes(1);
      expect(userService.configureDecathlon).toBeCalledWith(
        1,
        {
          access_token: 'access_token',
          token_type: 'bearer',
          refresh_token: 'refresh_token',
          expires_in: 1,
        },
        'userId',
        'webhookId',
      );
      expect(decathlonApi.getActivities).toBeCalledTimes(1);
      expect(decathlonApi.getActivities).toBeCalledWith('access_token');
      expect(userService.addActivities).toBeCalledTimes(1);
      expect(userService.addActivities).toBeCalledWith(1, {
        vendor: 'decathlon',
        vendorId: '1',
        name: 'Morning run',
        type: 'Bicycle',
        date: '2022-01-01T00:00:01Z',
        length: 1,
        duration: 1,
        heightDiffUp: 1,
      });
    });

    it('re-uses existing hook if available', async () => {
      jest.spyOn(decathlonApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
      });
      jest.spyOn(decathlonApi, 'getUserId').mockResolvedValueOnce('userId');
      jest.spyOn(decathlonApi, 'getExistingWebhookSubscription').mockResolvedValueOnce('webhookId');
      jest.spyOn(decathlonApi, 'createWebhookSubscription');
      jest.spyOn(userService, 'configureDecathlon').mockResolvedValueOnce(undefined);
      jest.spyOn(decathlonApi, 'getActivities').mockResolvedValueOnce([
        {
          id: '1',
          name: 'Morning run',
          sport: '/v2/sports/381',
          startdate: '2022-01-01T00:00:01Z',
          dataSummaries: {},
        },
      ]);
      jest.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

      const service = new DecathlonService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(decathlonApi.exchangeToken).toBeCalledTimes(1);
      expect(decathlonApi.exchangeToken).toBeCalledWith('code');
      expect(decathlonApi.getUserId).toBeCalledTimes(1);
      expect(decathlonApi.getUserId).toBeCalledWith('access_token');
      expect(decathlonApi.getExistingWebhookSubscription).toBeCalledTimes(1);
      expect(decathlonApi.getExistingWebhookSubscription).toBeCalledWith('access_token');
      expect(decathlonApi.createWebhookSubscription).not.toBeCalled();
      expect(userService.configureDecathlon).toBeCalledTimes(1);
      expect(userService.configureDecathlon).toBeCalledWith(
        1,
        {
          access_token: 'access_token',
          token_type: 'bearer',
          refresh_token: 'refresh_token',
          expires_in: 1,
        },
        'userId',
        'webhookId',
      );
      expect(decathlonApi.getActivities).toBeCalledTimes(1);
      expect(decathlonApi.getActivities).toBeCalledWith('access_token');
      expect(userService.addActivities).toBeCalledTimes(1);
      expect(userService.addActivities).toBeCalledWith(1, {
        vendor: 'decathlon',
        vendorId: '1',
        name: 'Morning run',
        type: 'Bicycle',
        date: '2022-01-01T00:00:01Z',
      });
    });

    it('stores activities only if there are some', async () => {
      jest.spyOn(decathlonApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
      });
      jest.spyOn(decathlonApi, 'getUserId').mockResolvedValueOnce('userId');
      jest.spyOn(decathlonApi, 'getExistingWebhookSubscription').mockResolvedValueOnce(undefined);
      jest.spyOn(decathlonApi, 'createWebhookSubscription').mockResolvedValueOnce('webhookId');
      jest.spyOn(userService, 'configureDecathlon').mockResolvedValueOnce(undefined);
      jest.spyOn(decathlonApi, 'getActivities').mockResolvedValueOnce([]);
      jest.spyOn(userService, 'addActivities');

      const service = new DecathlonService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(userService.configureDecathlon).toBeCalledTimes(1);
      expect(decathlonApi.getActivities).toBeCalledTimes(1);
      expect(userService.addActivities).not.toBeCalled();
    });

    it('throws if user id cannot be retrieved', async () => {
      jest.spyOn(decathlonApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
      });
      jest.spyOn(decathlonApi, 'getUserId').mockRejectedValueOnce(new Error('test'));
      jest.spyOn(decathlonApi, 'getExistingWebhookSubscription');
      jest.spyOn(userService, 'configureDecathlon');
      jest.spyOn(decathlonApi, 'getActivities');

      const service = new DecathlonService();
      await expect(
        service.requestShortLivedAccessTokenAndSetupUser(1, 'code'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"test"`);

      expect(decathlonApi.getUserId).toBeCalledTimes(1);
      expect(decathlonApi.getExistingWebhookSubscription).not.toBeCalled();
      expect(decathlonApi.getActivities).not.toBeCalled();
    });

    it('throws if exising webhooks cannot be retrieved', async () => {
      jest.spyOn(decathlonApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
      });
      jest.spyOn(decathlonApi, 'getUserId').mockResolvedValueOnce('userId');
      jest.spyOn(decathlonApi, 'getExistingWebhookSubscription').mockRejectedValueOnce(new Error('test'));
      jest.spyOn(userService, 'configureDecathlon');

      const service = new DecathlonService();
      await expect(
        service.requestShortLivedAccessTokenAndSetupUser(1, 'code'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"test"`);

      expect(decathlonApi.getExistingWebhookSubscription).toBeCalledTimes(1);
      expect(userService.configureDecathlon).not.toBeCalled();
    });

    it('throws if webhook cannot be setup', async () => {
      jest.spyOn(decathlonApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
      });
      jest.spyOn(decathlonApi, 'getUserId').mockResolvedValueOnce('userId');
      jest.spyOn(decathlonApi, 'getExistingWebhookSubscription').mockResolvedValueOnce(undefined);
      jest.spyOn(decathlonApi, 'createWebhookSubscription').mockRejectedValueOnce(new Error('test'));
      jest.spyOn(userService, 'configureDecathlon');

      const service = new DecathlonService();
      await expect(
        service.requestShortLivedAccessTokenAndSetupUser(1, 'code'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"test"`);

      expect(decathlonApi.createWebhookSubscription).toBeCalledTimes(1);
      expect(userService.configureDecathlon).not.toBeCalled();
    });

    it('throws if auth cannot be configured', async () => {
      jest.spyOn(decathlonApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
      });
      jest.spyOn(decathlonApi, 'getUserId').mockResolvedValueOnce('userId');
      jest.spyOn(decathlonApi, 'getExistingWebhookSubscription').mockResolvedValueOnce(undefined);
      jest.spyOn(decathlonApi, 'createWebhookSubscription').mockResolvedValueOnce('webhookId');
      jest.spyOn(userService, 'configureDecathlon').mockRejectedValueOnce(new Error('test'));
      jest.spyOn(decathlonApi, 'getActivities');

      const service = new DecathlonService();
      await expect(
        service.requestShortLivedAccessTokenAndSetupUser(1, 'code'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"test"`);

      expect(userService.configureDecathlon).toBeCalledTimes(1);
      expect(decathlonApi.getActivities).not.toBeCalled();
    });

    it('logs if activity retrieval fails', async () => {
      jest.spyOn(decathlonApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
      });
      jest.spyOn(decathlonApi, 'getUserId').mockResolvedValueOnce('userId');
      jest.spyOn(decathlonApi, 'getExistingWebhookSubscription').mockResolvedValueOnce(undefined);
      jest.spyOn(decathlonApi, 'createWebhookSubscription').mockResolvedValueOnce('webhookId');
      jest.spyOn(userService, 'configureDecathlon').mockResolvedValueOnce(undefined);
      jest.spyOn(decathlonApi, 'getActivities').mockRejectedValueOnce(undefined);
      jest.spyOn(userService, 'addActivities');

      const service = new DecathlonService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(decathlonApi.getActivities).toBeCalledTimes(1);
      expect(userService.addActivities).not.toBeCalled();
      expect(log.info).toBeCalledTimes(1);
      expect(log.info).toBeCalledWith(`Unable to retrieve Decathlon activities for user 1`);
    });
  });

  describe('deauthorize', () => {
    it('throws if no matching user is found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userService, 'getDecathlonInfo');

      const service = new DecathlonService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(`"User 1 not found"`);

      expect(userService.getDecathlonInfo).not.toBeCalled();
    });

    it('throws if no matching auth exists for user', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });

      const service = new DecathlonService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(
        `"No Decathlon auth defined for user 1"`,
      );
    });

    it('throws if no auth can be retrieved', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        decathlon: {
          id: 'userId',
          accessToken: 'access_token',
          expiresAt: 1,
          refreshToken: 'refresh_token',
          webhookId: 'webhookId',
        },
      });
      jest.spyOn(decathlonApi, 'refreshAuth').mockRejectedValueOnce(undefined);
      jest.spyOn(userService, 'clearDecathlonTokens').mockResolvedValueOnce(undefined);

      const service = new DecathlonService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Unable to retrieve token for user 1"`,
      );
    });

    it('calls decathlon API then updates DB', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        decathlon: {
          id: 'userId',
          accessToken: 'access_token',
          refreshToken: 'refreshSecret',
          expiresAt: 99999999999,
          webhookId: 'webhookId',
        },
      });
      jest.spyOn(decathlonApi, 'deleteWebhookSubscription').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new DecathlonService();
      await service.deauthorize(1);

      expect(decathlonApi.deleteWebhookSubscription).toBeCalledTimes(1);
      expect(decathlonApi.deleteWebhookSubscription).toBeCalledWith('webhookId', 'access_token');
      expect(activityRepository.deleteByUserAndVendor).toBeCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toBeCalledWith(1, 'decathlon');
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith(expect.not.objectContaining({ decathlon: expect.anything() }));
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
      jest.spyOn(userService, 'getDecathlonInfo').mockResolvedValueOnce({
        id: 'userId',
        accessToken: 'access_token',
        refreshToken: 'refreshSecret',
        expiresAt: 62,
        webhookId: 'webhookId',
      });
      jest.spyOn(decathlonApi, 'refreshAuth');

      const service = new DecathlonService();
      const result = await service.getToken(1);

      expect(result).toBe('access_token');
      expect(userService.getDecathlonInfo).toBeCalledTimes(1);
      expect(userService.getDecathlonInfo).toBeCalledWith(1);
    });

    it('retrieves a new access token if current one is expired', async () => {
      jest.spyOn(userService, 'getDecathlonInfo').mockResolvedValueOnce({
        id: 'userId',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: 61,
        webhookId: 'webhookId',
      });
      jest.spyOn(decathlonApi, 'refreshAuth').mockResolvedValueOnce({
        access_token: 'new_access_token',
        token_type: 'bearer',
        refresh_token: 'new_refresh_token',
        expires_in: 3540,
      });
      jest.spyOn(userService, 'updateDecathlonAuth').mockImplementationOnce(() => Promise.resolve());

      const service = new DecathlonService();
      const result = await service.getToken(1);

      expect(result).toBe('new_access_token');
      expect(decathlonApi.refreshAuth).toBeCalledTimes(1);
      expect(decathlonApi.refreshAuth).toBeCalledWith('refresh_token');
      expect(userService.updateDecathlonAuth).toBeCalledTimes(1);
      expect(userService.updateDecathlonAuth).toBeCalledWith(1, {
        access_token: 'new_access_token',
        token_type: 'bearer',
        refresh_token: 'new_refresh_token',
        expires_in: 3540,
      });
    });

    it('returns undefined if refresh fails', async () => {
      jest.spyOn(userService, 'getDecathlonInfo').mockResolvedValueOnce({
        id: 'userId',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: 61,
        webhookId: 'webhookId',
      });
      jest.spyOn(decathlonApi, 'refreshAuth').mockRejectedValueOnce(undefined);
      jest.spyOn(userService, 'clearDecathlonTokens').mockResolvedValueOnce(undefined);

      const service = new DecathlonService();
      const result = await service.getToken(1);

      expect(result).toBeUndefined();
      expect(decathlonApi.refreshAuth).toBeCalledTimes(1);
      expect(decathlonApi.refreshAuth).toBeCalledWith('refresh_token');
      expect(userService.clearDecathlonTokens).toBeCalledTimes(1);
    });
  });

  describe('getActivityGeometry', () => {
    it('throws if geometry cannot be retrieved', async () => {
      jest.spyOn(decathlonApi, 'getActivity').mockRejectedValueOnce(new Error('test'));

      const service = new DecathlonService();
      await expect(
        service.getActivityGeometry('access_token', 'activityId'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"test"`);
    });

    it('returns undefined if geometry has no locations', async () => {
      jest.spyOn(decathlonApi, 'getActivity').mockResolvedValueOnce({
        id: 'activityId',
        name: 'activity',
        sport: '/v2/sports/381',
        startdate: '1970-01-01T00:00:01Z',
        dataSummaries: {},
      });

      const service = new DecathlonService();
      const result = await service.getActivityGeometry('access_token', 'activityId');

      expect(result).toBeUndefined();
    });

    it('returns geometry', async () => {
      jest.spyOn(decathlonApi, 'getActivity').mockResolvedValueOnce({
        id: 'activityId',
        name: 'activity',
        sport: '/v2/sports/381',
        startdate: '1970-01-01T00:00:01Z',
        dataSummaries: {},
        locations: {
          '1': { latitude: 1.0, longitude: 1.0, elevation: 1.0 },
          '2': { latitude: 2.0, longitude: 2.0, elevation: 2.0 },
        },
      });

      const service = new DecathlonService();
      const result = await service.getActivityGeometry('access_token', 'activityId');

      expect(result).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              1,
              1,
              1,
              2,
            ],
            [
              2,
              2,
              2,
              3,
            ],
          ],
          "type": "LineString",
        }
      `);
    });
  });

  describe('handleWebhookEvent', () => {
    describe('activity create event', () => {
      it('warns if no matching user is found', async () => {
        jest.spyOn(userRepository, 'findByDecathlonId').mockResolvedValueOnce(undefined);

        const service = new DecathlonService();
        await service.handleWebhookEvent({
          user_id: 'userId',
          event: { name: 'activity_create', ressource_id: 'activityId', event_time: 1 },
        });

        expect(userRepository.findByDecathlonId).toBeCalledTimes(1);
        expect(userRepository.findByDecathlonId).toBeCalledWith('userId');
        expect(log.warn).toBeCalledTimes(1);
        expect(log.warn).toBeCalledWith(
          `Decathlon activity creation webhook event for Decathlon user userId couldn't be processed: unable to find matching user in DB`,
        );
      });

      it('warns if no token can be retrieved', async () => {
        jest.spyOn(userRepository, 'findByDecathlonId').mockResolvedValueOnce({ c2cId: 1 });

        const service = new DecathlonService();
        await service.handleWebhookEvent({
          user_id: 'userId',
          event: { name: 'activity_create', ressource_id: 'activityId', event_time: 1 },
        });

        expect(userRepository.findByDecathlonId).toBeCalledTimes(1);
        expect(userRepository.findByDecathlonId).toBeCalledWith('userId');
        expect(log.warn).toBeCalledTimes(1);
        expect(log.warn).toBeCalledWith(
          `Decathlon activity creation webhook event for user 1 couldn't be processed: unable to acquire valid token`,
        );
      });

      it('warns if event activity cannot be retrieved', async () => {
        jest.spyOn(userRepository, 'findByDecathlonId').mockResolvedValueOnce({
          c2cId: 1,
          decathlon: {
            id: 'userId',
            accessToken: 'access_token',
            expiresAt: 999999999999,
            refreshToken: 'refresh_token',
            webhookId: 'webhookId',
          },
        });
        jest.spyOn(decathlonApi, 'getActivity').mockRejectedValueOnce(undefined);

        const service = new DecathlonService();
        await service.handleWebhookEvent({
          user_id: 'userId',
          event: { name: 'activity_create', ressource_id: 'activityId', event_time: 1 },
        });

        expect(userRepository.findByDecathlonId).toBeCalledTimes(1);
        expect(userRepository.findByDecathlonId).toBeCalledWith('userId');
        expect(decathlonApi.getActivity).toBeCalledTimes(1);
        expect(decathlonApi.getActivity).toBeCalledWith('access_token', 'activityId');
        expect(log.warn).toBeCalledTimes(1);
        expect(log.warn).toBeCalledWith(
          `Decathlon activity creation webhook event for user 1 couldn't be processed: unable to retrieve activity data`,
        );
      });

      it('warns if event activity cannot be stored', async () => {
        jest.spyOn(userRepository, 'findByDecathlonId').mockResolvedValueOnce({
          c2cId: 1,
          decathlon: {
            id: 'userId',
            accessToken: 'access_token',
            expiresAt: 999999999999,
            refreshToken: 'refresh_token',
            webhookId: 'webhookId',
          },
        });
        jest.spyOn(decathlonApi, 'getActivity').mockResolvedValueOnce({
          id: 'activityId',
          name: 'name',
          sport: '/v2/sports/381',
          startdate: '1970-01-01T00:00:01Z',
          dataSummaries: {},
          locations: { '0': { latitude: 1.0, longitude: 1.0, elevation: 1.0 } },
        });
        jest.spyOn(userService, 'addActivities').mockRejectedValueOnce(undefined);

        const service = new DecathlonService();
        await service.handleWebhookEvent({
          user_id: 'userId',
          event: { name: 'activity_create', ressource_id: 'activityId', event_time: 1 },
        });

        expect(userRepository.findByDecathlonId).toBeCalledTimes(1);
        expect(userRepository.findByDecathlonId).toBeCalledWith('userId');
        expect(decathlonApi.getActivity).toBeCalledTimes(1);
        expect(decathlonApi.getActivity).toBeCalledWith('access_token', 'activityId');
        expect(userService.addActivities).toBeCalledTimes(1);
        expect(userService.addActivities).toBeCalledWith(1, {
          vendor: 'decathlon',
          vendorId: 'activityId',
          date: '1970-01-01T00:00:01Z',
          name: 'name',
          type: 'Bicycle',
          geojson: { type: 'LineString', coordinates: [[1, 1, 1, 1]] },
        });
        expect(log.warn).toBeCalledTimes(1);
        expect(log.warn).toBeCalledWith(
          `Decathlon activity creation webhook event for user 1 couldn't be processed: unable to insert activity data`,
        );
      });

      it('saves event activity', async () => {
        jest.spyOn(userRepository, 'findByDecathlonId').mockResolvedValueOnce({
          c2cId: 1,
          decathlon: {
            id: 'userId',
            accessToken: 'access_token',
            expiresAt: 999999999999,
            refreshToken: 'refresh_token',
            webhookId: 'webhookId',
          },
        });
        jest.spyOn(decathlonApi, 'getActivity').mockResolvedValueOnce({
          id: 'activityId',
          name: 'name',
          sport: '/v2/sports/381',
          startdate: '1970-01-01T00:00:01Z',
          dataSummaries: {},
          locations: { '0': { latitude: 1.0, longitude: 1.0, elevation: 1.0 } },
        });
        jest.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

        const service = new DecathlonService();
        await service.handleWebhookEvent({
          user_id: 'userId',
          event: { name: 'activity_create', ressource_id: 'activityId', event_time: 1 },
        });

        expect(userRepository.findByDecathlonId).toBeCalledTimes(1);
        expect(userRepository.findByDecathlonId).toBeCalledWith('userId');
        expect(decathlonApi.getActivity).toBeCalledTimes(1);
        expect(decathlonApi.getActivity).toBeCalledWith('access_token', 'activityId');
        expect(userService.addActivities).toBeCalledTimes(1);
        expect(userService.addActivities).toBeCalledWith(1, {
          vendor: 'decathlon',
          vendorId: 'activityId',
          date: '1970-01-01T00:00:01Z',
          name: 'name',
          type: 'Bicycle',
          geojson: { type: 'LineString', coordinates: [[1, 1, 1, 1]] },
        });
        expect(log.warn).not.toBeCalled();
      });
    });

    describe('activity delete event', () => {
      it('warns if activity cannot be deleted', async () => {
        jest.spyOn(userService, 'deleteActivity').mockRejectedValueOnce(undefined);

        const service = new DecathlonService();
        await service.handleWebhookEvent({
          user_id: 'userId',
          event: { name: 'activity_delete', ressource_id: 'activityId', event_time: 1 },
        });

        expect(log.warn).toBeCalledTimes(1);
        expect(log.warn).toBeCalledWith(
          `Decathlon activity delete webhook event for activity activityId couldn't be processed: unable to delete activity data in DB`,
        );
      });

      it('deletes activity', async () => {
        jest.spyOn(userService, 'deleteActivity').mockResolvedValueOnce(undefined);

        const service = new DecathlonService();
        await service.handleWebhookEvent({
          user_id: 'userId',
          event: { name: 'activity_delete', ressource_id: 'activityId', event_time: 1 },
        });

        expect(log.warn).not.toBeCalled();
      });
    });
  });
});
