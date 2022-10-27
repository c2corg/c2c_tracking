import log from '../../../../src/helpers/logger';
import { activityRepository } from '../../../../src/repository/activity.repository';
import { userRepository } from '../../../../src/repository/user.repository';
import { suuntoApi } from '../../../../src/server/suunto/suunto.api';
import { SuuntoService } from '../../../../src/server/suunto/suunto.service';
import { userService } from '../../../../src/user.service';

describe('Suunto Service', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(log, 'debug').mockImplementation(() => Promise.resolve());
    jest.spyOn(log, 'info').mockImplementation(() => Promise.resolve());
    jest.spyOn(log, 'warn').mockImplementation(() => Promise.resolve());
  });

  describe('requestShortLivedAccessTokenAndSetupUser', () => {
    it('handles configuration failure', async () => {
      jest.spyOn(suuntoApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      jest.spyOn(userService, 'configureSuunto').mockRejectedValueOnce(undefined);
      jest.spyOn(suuntoApi, 'getWorkouts');

      const service = new SuuntoService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(userService.configureSuunto).toBeCalledTimes(1);
      expect(userService.configureSuunto).toBeCalledWith(1, {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      expect(suuntoApi.getWorkouts).not.toBeCalled();
      expect(log.warn).toBeCalledTimes(1);
    });

    it('handles activities retrieval failure', async () => {
      jest.spyOn(suuntoApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      jest.spyOn(userService, 'configureSuunto').mockResolvedValueOnce(undefined);
      jest.spyOn(suuntoApi, 'getWorkouts').mockRejectedValueOnce(undefined);
      jest.spyOn(userService, 'addActivities');

      const service = new SuuntoService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(userService.configureSuunto).toBeCalledTimes(1);
      expect(userService.configureSuunto).toBeCalledWith(1, {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      expect(suuntoApi.getWorkouts).toBeCalledTimes(1);
      expect(suuntoApi.getWorkouts).toBeCalledWith('access_token', expect.any(String));
      expect(userService.addActivities).not.toBeCalled();
      expect(log.warn).toBeCalledTimes(1);
    });

    it('handles activities retrieval failure (2)', async () => {
      jest.spyOn(suuntoApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      jest.spyOn(userService, 'configureSuunto').mockResolvedValueOnce(undefined);
      jest.spyOn(suuntoApi, 'getWorkouts').mockResolvedValueOnce({
        payload: [
          {
            workoutId: 1,
            workoutKey: '1',
            activityId: 1,
            workoutName: 'name',
            description: 'description',
            startTime: 1,
            totalTime: 1,
            timeOffsetInMinutes: 0,
          },
        ],
        metadata: {},
      });
      jest.spyOn(userService, 'addActivities').mockRejectedValueOnce(undefined);

      const service = new SuuntoService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(userService.configureSuunto).toBeCalledTimes(1);
      expect(userService.configureSuunto).toBeCalledWith(1, {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      expect(suuntoApi.getWorkouts).toBeCalledTimes(1);
      expect(suuntoApi.getWorkouts).toBeCalledWith('access_token', expect.any(String));
      expect(userService.addActivities).toBeCalledTimes(1);
      expect(userService.addActivities).toBeCalledWith(1, {
        vendor: 'suunto',
        vendorId: '1',
        date: '1970-01-01T00:00:00Z',
        name: 'name',
        type: 'Running',
      });
      expect(log.warn).toBeCalledTimes(1);
    });

    it('does not call addActivities if none are retrieved', async () => {
      jest.spyOn(suuntoApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      jest.spyOn(userService, 'configureSuunto').mockResolvedValueOnce(undefined);
      jest.spyOn(suuntoApi, 'getWorkouts').mockResolvedValueOnce({ payload: [], metadata: {} });
      jest.spyOn(userService, 'addActivities').mockRejectedValueOnce(undefined);

      const service = new SuuntoService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(userService.configureSuunto).toBeCalledTimes(1);
      expect(userService.configureSuunto).toBeCalledWith(1, {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      expect(suuntoApi.getWorkouts).toBeCalledTimes(1);
      expect(suuntoApi.getWorkouts).toBeCalledWith('access_token', expect.any(String));
      expect(userService.addActivities).not.toBeCalled();
    });

    it('calls API then setups user', async () => {
      jest.spyOn(suuntoApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      jest.spyOn(userService, 'configureSuunto').mockResolvedValueOnce(undefined);
      jest.spyOn(suuntoApi, 'getWorkouts').mockResolvedValueOnce({
        payload: [
          {
            workoutId: 1,
            workoutKey: '1',
            activityId: 1,
            workoutName: 'name',
            description: 'description',
            startTime: 1,
            totalTime: 1,
            timeOffsetInMinutes: 0,
          },
        ],
        metadata: {},
      });
      jest.spyOn(userService, 'addActivities').mockImplementationOnce(() => {
        return Promise.resolve();
      });

      const service = new SuuntoService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(userService.configureSuunto).toBeCalledTimes(1);
      expect(userService.configureSuunto).toBeCalledWith(1, {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      expect(suuntoApi.getWorkouts).toBeCalledTimes(1);
      expect(suuntoApi.getWorkouts).toBeCalledWith('access_token', expect.any(String));
      expect(userService.addActivities).toBeCalledTimes(1);
      expect(userService.addActivities).toBeCalledWith(1, {
        vendor: 'suunto',
        vendorId: '1',
        date: '1970-01-01T00:00:00Z',
        name: 'name',
        type: 'Running',
      });
      expect(log.warn).not.toBeCalled();
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
      jest.spyOn(userService, 'getSuuntoInfo').mockResolvedValueOnce({
        username: 'user',
        accessToken: 'access_token',
        refreshToken: 'refreshSecret',
        expiresAt: 62,
      });
      jest.spyOn(suuntoApi, 'refreshAuth');

      const service = new SuuntoService();
      const result = await service.getToken(1);

      expect(result).toBe('access_token');
      expect(userService.getSuuntoInfo).toBeCalledTimes(1);
      expect(userService.getSuuntoInfo).toBeCalledWith(1);
    });

    it('retrieves a new access token if current one is expired', async () => {
      jest.spyOn(userService, 'getSuuntoInfo').mockResolvedValueOnce({
        username: 'user',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: 61,
      });
      jest.spyOn(suuntoApi, 'refreshAuth').mockResolvedValueOnce({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3540,
        token_type: 'bearer',
      });
      jest.spyOn(userService, 'updateSuuntoAuth').mockImplementationOnce(() => Promise.resolve());

      const service = new SuuntoService();
      const result = await service.getToken(1);

      expect(result).toBe('new_access_token');
      expect(suuntoApi.refreshAuth).toBeCalledTimes(1);
      expect(suuntoApi.refreshAuth).toBeCalledWith('refresh_token');
      expect(userService.updateSuuntoAuth).toBeCalledTimes(1);
      expect(userService.updateSuuntoAuth).toBeCalledWith(1, {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3540,
        token_type: 'bearer',
      });
    });

    it('returns undefined if refresh fails', async () => {
      jest.spyOn(userService, 'getSuuntoInfo').mockResolvedValueOnce({
        username: 'user',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: 61,
      });
      jest.spyOn(suuntoApi, 'refreshAuth').mockRejectedValueOnce(undefined);
      jest.spyOn(userService, 'clearSuuntoTokens').mockResolvedValueOnce(undefined);

      const service = new SuuntoService();
      const result = await service.getToken(1);

      expect(result).toBeUndefined();
      expect(suuntoApi.refreshAuth).toBeCalledTimes(1);
      expect(suuntoApi.refreshAuth).toBeCalledWith('refresh_token');
      expect(userService.clearSuuntoTokens).toBeCalledTimes(1);
    });
  });

  describe('getFIT', () => {
    it('calls API', async () => {
      const fit = new Uint8Array();
      jest.spyOn(suuntoApi, 'getFIT').mockResolvedValueOnce(fit);

      const service = new SuuntoService();
      const response = await service.getFIT('token', '1');

      expect(response).toBe(fit);
    });
  });

  describe('handleWebhookEvent', () => {
    it('filters out event with bad authentication', async () => {
      const service = new SuuntoService();
      await service.handleWebhookEvent({ username: 'user', workoutid: '1' }, undefined);

      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
        `Suunto workout webhook event for Suunto user user couldn't be processed: bad auth`,
      );
    });

    it('warns if user is not found', async () => {
      jest.spyOn(userRepository, 'findBySuuntoUsername').mockResolvedValueOnce(undefined);
      const service = new SuuntoService();
      await service.handleWebhookEvent(
        { username: 'user', workoutid: '1' },
        `Bearer: 2fbbd34d-4dc3-44fc-8a47-9ba1bc037d2c`,
      );

      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
        `Suunto workout webhook event for Suunto user user couldn't be processed: unable to find matching user in DB`,
      );
    });

    it('warns if token cannot be retrieved', async () => {
      jest.spyOn(userRepository, 'findBySuuntoUsername').mockResolvedValueOnce({ c2cId: 1 });
      const getTokenSpy = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SuuntoService.prototype as any, 'getToken')
        .mockResolvedValueOnce(undefined);

      const service = new SuuntoService();
      await service.handleWebhookEvent(
        { username: 'user', workoutid: '1' },
        `Bearer: 2fbbd34d-4dc3-44fc-8a47-9ba1bc037d2c`,
      );

      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
        `Suunto workout webhook event for user 1 couldn't be processed: unable to acquire valid token`,
      );

      getTokenSpy.mockRestore();
    });

    it('warns if activity data could not be retrieved', async () => {
      jest.spyOn(userRepository, 'findBySuuntoUsername').mockResolvedValueOnce({ c2cId: 1 });
      const getTokenSpy = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SuuntoService.prototype as any, 'getToken')
        .mockResolvedValueOnce('token');
      jest.spyOn(suuntoApi, 'getWorkoutDetails').mockRejectedValueOnce(undefined);

      const service = new SuuntoService();
      await service.handleWebhookEvent(
        { username: 'user', workoutid: '1' },
        `Bearer: 2fbbd34d-4dc3-44fc-8a47-9ba1bc037d2c`,
      );

      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
        `Suunto workout webhook event for user 1 couldn't be processed: unable to retrieve activity data`,
      );

      getTokenSpy.mockRestore();
    });

    it('warns if activity data cannot be saved', async () => {
      jest.spyOn(userRepository, 'findBySuuntoUsername').mockResolvedValueOnce({ c2cId: 1 });
      const getTokenSpy = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SuuntoService.prototype as any, 'getToken')
        .mockResolvedValueOnce('token');
      jest.spyOn(suuntoApi, 'getWorkoutDetails').mockResolvedValueOnce({
        payload: {
          workoutId: 1,
          workoutKey: '1',
          activityId: 1,
          description: 'description',
          workoutName: 'name',
          startTime: 1,
          totalTime: 1,
          timeOffsetInMinutes: 0,
        },
        metadata: {},
      });
      jest.spyOn(userService, 'addActivities').mockRejectedValueOnce(undefined);

      const service = new SuuntoService();
      await service.handleWebhookEvent(
        { username: 'user', workoutid: '1' },
        `Bearer: 2fbbd34d-4dc3-44fc-8a47-9ba1bc037d2c`,
      );

      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
        `Suunto activity update/creation webhook event for user 1 couldn't be processed: unable to upsert activity data`,
      );

      getTokenSpy.mockRestore();
    });

    it('handles event', async () => {
      jest.spyOn(userRepository, 'findBySuuntoUsername').mockResolvedValueOnce({ c2cId: 1 });
      const getTokenSpy = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SuuntoService.prototype as any, 'getToken')
        .mockResolvedValueOnce('token');
      jest.spyOn(suuntoApi, 'getWorkoutDetails').mockResolvedValueOnce({
        payload: {
          workoutId: 1,
          workoutKey: '1',
          activityId: 1,
          description: 'description',
          workoutName: 'name',
          startTime: 1,
          totalTime: 1,
          timeOffsetInMinutes: 0,
        },
        metadata: {},
      });
      jest.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

      const service = new SuuntoService();
      await service.handleWebhookEvent(
        { username: 'user', workoutid: '1' },
        `Bearer: 2fbbd34d-4dc3-44fc-8a47-9ba1bc037d2c`,
      );

      expect(log.warn).not.toBeCalled();

      getTokenSpy.mockRestore();
    });
  });

  describe('deauthorize', () => {
    it('throws if user is not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);

      const service = new SuuntoService();
      await expect(service.deauthorize(1)).rejects.toMatchInlineSnapshot(`[Error: User 1 not found]`);
    });

    it('throws if token cannot be retrieved', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      const getTokenSpy = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SuuntoService.prototype as any, 'getToken')
        .mockResolvedValueOnce(undefined);

      const service = new SuuntoService();
      await expect(service.deauthorize(1)).rejects.toMatchInlineSnapshot(`[Error: User 1 not found]`);

      getTokenSpy.mockRestore();
    });

    it('deauthorizes user and clears data', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        suunto: {
          username: 'user',
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresAt: 1,
        },
        strava: {
          id: 1,
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresAt: 1,
        },
      });
      const getTokenSpy = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SuuntoService.prototype as any, 'getToken')
        .mockResolvedValueOnce('token');
      jest.spyOn(suuntoApi, 'deauthorize').mockResolvedValueOnce(undefined);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'update').mockRejectedValueOnce(undefined);

      const service = new SuuntoService();
      await expect(service.deauthorize(1)).rejects.toMatchInlineSnapshot(`undefined`);

      expect(suuntoApi.deauthorize).toBeCalledTimes(1);
      expect(suuntoApi.deauthorize).toBeCalledWith('token');
      expect(activityRepository.deleteByUserAndVendor).toBeCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toBeCalledWith(1, 'suunto');
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith({
        c2cId: 1,
        strava: {
          id: 1,
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresAt: 1,
        },
      });

      getTokenSpy.mockRestore();
    });
  });
});
