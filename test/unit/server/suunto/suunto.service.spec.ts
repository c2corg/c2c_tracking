import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import log from '../../../../src/helpers/logger.js';
import { miniatureService } from '../../../../src/miniature.service';
import { activityRepository } from '../../../../src/repository/activity.repository';
import { userRepository } from '../../../../src/repository/user.repository';
import { suuntoApi } from '../../../../src/server/suunto/suunto.api';
import { SuuntoService } from '../../../../src/server/suunto/suunto.service';
import { userService } from '../../../../src/user.service';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

describe('Suunto Service', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(log, 'debug').mockImplementation(() => {
      /* do nothing */
    });
    jest.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    jest.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
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

      expect(userService.configureSuunto).toHaveBeenCalledTimes(1);
      expect(userService.configureSuunto).toHaveBeenCalledWith(1, {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      expect(suuntoApi.getWorkouts).not.toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalledTimes(1);
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

      expect(userService.configureSuunto).toHaveBeenCalledTimes(1);
      expect(userService.configureSuunto).toHaveBeenCalledWith(1, {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      expect(suuntoApi.getWorkouts).toHaveBeenCalledTimes(1);
      expect(suuntoApi.getWorkouts).toHaveBeenCalledWith('access_token', expect.any(String));
      expect(userService.addActivities).not.toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalledTimes(1);
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
            startTime: 1,
            totalTime: 1,
            totalAscent: 1.2,
            totalDistance: 1.2,
            timeOffsetInMinutes: 60,
          },
        ],
        metadata: {},
      });
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const fit = readFileSync(resolve(__dirname, '../../../resources/mini.fit'));
      jest.spyOn(suuntoApi, 'getFIT').mockResolvedValueOnce(fit);
      jest.spyOn(userService, 'addActivities').mockRejectedValueOnce(undefined);

      const service = new SuuntoService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(userService.configureSuunto).toHaveBeenCalledTimes(1);
      expect(userService.configureSuunto).toHaveBeenCalledWith(1, {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      expect(suuntoApi.getWorkouts).toHaveBeenCalledTimes(1);
      expect(suuntoApi.getWorkouts).toHaveBeenCalledWith('access_token', expect.any(String));
      expect(userService.addActivities).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).toHaveBeenCalledWith(1, {
        vendor: 'suunto',
        vendorId: '1',
        date: '1970-01-01T01:00:00+01:00',
        name: 'name',
        type: 'Running',
        duration: 1,
        geojson: {
          coordinates: [
            [5.825548013672233, 44.972592014819384, 1503, 1670140122],
            [5.825552036985755, 44.97256896458566, 1503, 1670140124],
          ],
          type: 'LineString',
        },
        heightDiffUp: 1,
        length: 1,
      });
      expect(log.warn).toHaveBeenCalledTimes(1);
    });

    it('filters out activities without geometry', async () => {
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
            startTime: 1,
            totalTime: 1,
            totalAscent: 1.2,
            totalDistance: 1.2,
            timeOffsetInMinutes: 60,
          },
        ],
        metadata: {},
      });
      const fit = new Uint8Array();
      jest.spyOn(suuntoApi, 'getFIT').mockResolvedValueOnce(fit);
      jest.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

      const service = new SuuntoService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(userService.configureSuunto).toHaveBeenCalledTimes(1);
      expect(userService.configureSuunto).toHaveBeenCalledWith(1, {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      expect(suuntoApi.getWorkouts).toHaveBeenCalledTimes(1);
      expect(suuntoApi.getWorkouts).toHaveBeenCalledWith('access_token', expect.any(String));
      expect(userService.addActivities).toHaveBeenCalledWith(1);
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
            startTime: 1,
            totalTime: 1,
            totalAscent: 1.2,
            totalDistance: 1.2,
            timeOffsetInMinutes: 0,
          },
        ],
        metadata: {},
      });
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const fit = readFileSync(resolve(__dirname, '../../../resources/mini.fit'));
      jest.spyOn(suuntoApi, 'getFIT').mockResolvedValueOnce(fit);
      jest.spyOn(userService, 'addActivities').mockImplementationOnce(() => Promise.resolve());

      const service = new SuuntoService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(userService.configureSuunto).toHaveBeenCalledTimes(1);
      expect(userService.configureSuunto).toHaveBeenCalledWith(1, {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      expect(suuntoApi.getWorkouts).toHaveBeenCalledTimes(1);
      expect(suuntoApi.getWorkouts).toHaveBeenCalledWith('access_token', expect.any(String));
      expect(userService.addActivities).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).toHaveBeenCalledWith(1, {
        vendor: 'suunto',
        vendorId: '1',
        date: '1970-01-01T00:00:00Z',
        name: 'name',
        type: 'Running',
        duration: 1,
        geojson: {
          coordinates: [
            [5.825548013672233, 44.972592014819384, 1503, 1670140122],
            [5.825552036985755, 44.97256896458566, 1503, 1670140124],
          ],
          type: 'LineString',
        },
        heightDiffUp: 1,
        length: 1,
      });
      expect(log.warn).not.toHaveBeenCalled();
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
      expect(userService.getSuuntoInfo).toHaveBeenCalledTimes(1);
      expect(userService.getSuuntoInfo).toHaveBeenCalledWith(1);
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
      expect(suuntoApi.refreshAuth).toHaveBeenCalledTimes(1);
      expect(suuntoApi.refreshAuth).toHaveBeenCalledWith('refresh_token');
      expect(userService.updateSuuntoAuth).toHaveBeenCalledTimes(1);
      expect(userService.updateSuuntoAuth).toHaveBeenCalledWith(1, {
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
      expect(suuntoApi.refreshAuth).toHaveBeenCalledTimes(1);
      expect(suuntoApi.refreshAuth).toHaveBeenCalledWith('refresh_token');
      expect(userService.clearSuuntoTokens).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleWebhookEvent', () => {
    it('filters out event with bad authentication', async () => {
      const service = new SuuntoService();
      await service.handleWebhookEvent({ username: 'user', workoutid: '1' }, undefined);

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        `Suunto workout webhook event for Suunto user user couldn't be processed: bad auth`,
      );
    });

    it('warns if user is not found', async () => {
      jest.spyOn(userRepository, 'findBySuuntoUsername').mockResolvedValueOnce(undefined);
      const service = new SuuntoService();
      await service.handleWebhookEvent(
        { username: 'user', workoutid: '1' },
        `Bearer 2fbbd34d-4dc3-44fc-8a47-9ba1bc037d2c`,
      );

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
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
        `Bearer 2fbbd34d-4dc3-44fc-8a47-9ba1bc037d2c`,
      );

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
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
        `Bearer 2fbbd34d-4dc3-44fc-8a47-9ba1bc037d2c`,
      );

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
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
          workoutName: 'name',
          startTime: 1,
          totalTime: 1,
          totalAscent: 1,
          totalDistance: 1,
          timeOffsetInMinutes: 0,
        },
        metadata: {},
      });
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const fit = readFileSync(resolve(__dirname, '../../../resources/mini.fit'));
      jest.spyOn(suuntoApi, 'getFIT').mockResolvedValueOnce(fit);
      jest.spyOn(userService, 'addActivities').mockRejectedValueOnce(undefined);

      const service = new SuuntoService();
      await service.handleWebhookEvent(
        { username: 'user', workoutid: '1' },
        `Bearer 2fbbd34d-4dc3-44fc-8a47-9ba1bc037d2c`,
      );

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        `Suunto activity update/creation webhook event for user 1 couldn't be processed: unable to upsert activity data`,
      );

      getTokenSpy.mockRestore();
    });

    it('ignores activity without geometry', async () => {
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
          workoutName: 'name',
          startTime: 1,
          totalTime: 1,
          totalAscent: 1,
          totalDistance: 1,
          timeOffsetInMinutes: 0,
        },
        metadata: {},
      });
      jest.spyOn(suuntoApi, 'getFIT').mockRejectedValueOnce(undefined);
      jest.spyOn(userService, 'addActivities');

      const service = new SuuntoService();
      await service.handleWebhookEvent(
        { username: 'user', workoutid: '1' },
        `Bearer 2fbbd34d-4dc3-44fc-8a47-9ba1bc037d2c`,
      );

      expect(log.warn).not.toHaveBeenCalled();
      expect(userService.addActivities).not.toHaveBeenCalled();

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
          workoutName: 'name',
          startTime: 1,
          totalTime: 1,
          totalAscent: 1,
          totalDistance: 1,
          timeOffsetInMinutes: 0,
        },
        metadata: {},
      });
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const fit = readFileSync(resolve(__dirname, '../../../resources/mini.fit'));
      jest.spyOn(suuntoApi, 'getFIT').mockResolvedValueOnce(fit);
      jest.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

      const service = new SuuntoService();
      await service.handleWebhookEvent(
        { username: 'user', workoutid: '1' },
        `Bearer 2fbbd34d-4dc3-44fc-8a47-9ba1bc037d2c`,
      );

      expect(log.warn).not.toHaveBeenCalled();

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
      jest.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce([]);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'update').mockRejectedValueOnce(undefined);
      jest.spyOn(miniatureService, 'deleteMiniature');

      const service = new SuuntoService();
      await expect(service.deauthorize(1)).rejects.toMatchInlineSnapshot(`undefined`);

      expect(suuntoApi.deauthorize).toHaveBeenCalledTimes(1);
      expect(suuntoApi.deauthorize).toHaveBeenCalledWith('token');
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'suunto');
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'suunto');
      expect(miniatureService.deleteMiniature).not.toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      expect(userRepository.update).toHaveBeenCalledWith({
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

    it('warns if no miniature info could be retrieved', async () => {
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
      jest.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockImplementationOnce(() => Promise.reject());
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'update').mockRejectedValueOnce(undefined);
      jest.spyOn(miniatureService, 'deleteMiniature');

      const service = new SuuntoService();
      await expect(service.deauthorize(1)).rejects.toMatchInlineSnapshot(`undefined`);

      expect(suuntoApi.deauthorize).toHaveBeenCalledTimes(1);
      expect(suuntoApi.deauthorize).toHaveBeenCalledWith('token');
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'suunto');
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(`Failed retrieving miniatures info for user 1 and vendor suunto`);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'suunto');
      expect(miniatureService.deleteMiniature).not.toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      expect(userRepository.update).toHaveBeenCalledWith({
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

    it('warns if miniature could not be deleted', async () => {
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
      jest.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce(['miniature.png']);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'update').mockRejectedValueOnce(undefined);
      jest.spyOn(miniatureService, 'deleteMiniature').mockImplementationOnce(() => Promise.reject());

      const service = new SuuntoService();
      await expect(service.deauthorize(1)).rejects.toMatchInlineSnapshot(`undefined`);

      expect(suuntoApi.deauthorize).toHaveBeenCalledTimes(1);
      expect(suuntoApi.deauthorize).toHaveBeenCalledWith('token');
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'suunto');
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'suunto');
      expect(miniatureService.deleteMiniature).toHaveBeenCalledTimes(1);
      expect(miniatureService.deleteMiniature).toHaveBeenCalledWith('miniature.png');
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(`Failed deleting miniature miniature.png`);
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      expect(userRepository.update).toHaveBeenCalledWith({
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

    it('deletes miniatures', async () => {
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
      jest.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce(['miniature.png']);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'update').mockRejectedValueOnce(undefined);
      jest.spyOn(miniatureService, 'deleteMiniature').mockImplementationOnce(() => Promise.resolve());

      const service = new SuuntoService();
      await expect(service.deauthorize(1)).rejects.toMatchInlineSnapshot(`undefined`);

      expect(suuntoApi.deauthorize).toHaveBeenCalledTimes(1);
      expect(suuntoApi.deauthorize).toHaveBeenCalledWith('token');
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'suunto');
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'suunto');
      expect(miniatureService.deleteMiniature).toHaveBeenCalledTimes(1);
      expect(miniatureService.deleteMiniature).toHaveBeenCalledWith('miniature.png');
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      expect(userRepository.update).toHaveBeenCalledWith({
        c2cId: 1,
        strava: {
          id: 1,
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresAt: 1,
        },
      });
      expect(log.warn).not.toHaveBeenCalled();

      getTokenSpy.mockRestore();
    });
  });
});
