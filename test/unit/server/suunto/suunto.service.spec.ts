import { readFileSync } from 'fs';
import { resolve } from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import log from '../../../../src/helpers/logger';
import { miniatureService } from '../../../../src/miniature.service';
import { activityRepository } from '../../../../src/repository/activity.repository';
import { userRepository } from '../../../../src/repository/user.repository';
import { suuntoApi } from '../../../../src/server/suunto/suunto.api';
import { SuuntoService } from '../../../../src/server/suunto/suunto.service';
import { userService } from '../../../../src/user.service';

describe('Suunto Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(log, 'debug').mockImplementation(() => {
      /* do nothing */
    });
    vi.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    vi.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('requestShortLivedAccessTokenAndSetupUser', () => {
    it('handles configuration failure', async () => {
      vi.spyOn(suuntoApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      vi.spyOn(userService, 'configureSuunto').mockRejectedValueOnce(undefined);
      vi.spyOn(suuntoApi, 'getWorkouts');

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
      vi.spyOn(suuntoApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      vi.spyOn(userService, 'configureSuunto').mockResolvedValueOnce(undefined);
      vi.spyOn(suuntoApi, 'getWorkouts').mockRejectedValueOnce(undefined);
      vi.spyOn(userService, 'addActivities');

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
      vi.spyOn(suuntoApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      vi.spyOn(userService, 'configureSuunto').mockResolvedValueOnce(undefined);
      vi.spyOn(suuntoApi, 'getWorkouts').mockResolvedValueOnce({
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
      const fit = new Uint8Array(readFileSync(resolve(__dirname, '../../../resources/mini.fit'))).buffer;
      vi.spyOn(suuntoApi, 'getFIT').mockResolvedValueOnce(fit);
      vi.spyOn(userService, 'addActivities').mockRejectedValueOnce(undefined);

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
      vi.spyOn(suuntoApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      vi.spyOn(userService, 'configureSuunto').mockResolvedValueOnce(undefined);
      vi.spyOn(suuntoApi, 'getWorkouts').mockResolvedValueOnce({
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
      const fit = new ArrayBuffer(0);
      vi.spyOn(suuntoApi, 'getFIT').mockResolvedValueOnce(fit);
      vi.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

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
      vi.spyOn(suuntoApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 1,
        user: 'user',
      });
      vi.spyOn(userService, 'configureSuunto').mockResolvedValueOnce(undefined);
      vi.spyOn(suuntoApi, 'getWorkouts').mockResolvedValueOnce({
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
      const fit = new Uint8Array(readFileSync(resolve(__dirname, '../../../resources/mini.fit'))).buffer;
      vi.spyOn(suuntoApi, 'getFIT').mockResolvedValueOnce(fit);
      vi.spyOn(userService, 'addActivities').mockImplementationOnce(() => Promise.resolve());

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
      vi.useFakeTimers({ now: new Date('1970-01-01T00:00:01Z') });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns access_token if still valid for 1 minute', async () => {
      vi.spyOn(userService, 'getSuuntoInfo').mockResolvedValueOnce({
        username: 'user',
        accessToken: 'access_token',
        refreshToken: 'refreshSecret',
        expiresAt: 62,
      });
      vi.spyOn(suuntoApi, 'refreshAuth');

      const service = new SuuntoService();
      const result = await service.getToken(1);

      expect(result).toBe('access_token');
      expect(userService.getSuuntoInfo).toHaveBeenCalledTimes(1);
      expect(userService.getSuuntoInfo).toHaveBeenCalledWith(1);
    });

    it('retrieves a new access token if current one is expired', async () => {
      vi.spyOn(userService, 'getSuuntoInfo').mockResolvedValueOnce({
        username: 'user',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: 61,
      });
      vi.spyOn(suuntoApi, 'refreshAuth').mockResolvedValueOnce({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3540,
        token_type: 'bearer',
      });
      vi.spyOn(userService, 'updateSuuntoAuth').mockImplementationOnce(() => Promise.resolve());

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
      vi.spyOn(userService, 'getSuuntoInfo').mockResolvedValueOnce({
        username: 'user',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: 61,
      });
      vi.spyOn(suuntoApi, 'refreshAuth').mockRejectedValueOnce(undefined);
      vi.spyOn(userService, 'clearSuuntoTokens').mockResolvedValueOnce(undefined);

      const service = new SuuntoService();
      const result = await service.getToken(1);

      expect(result).toBeUndefined();
      expect(suuntoApi.refreshAuth).toHaveBeenCalledTimes(1);
      expect(suuntoApi.refreshAuth).toHaveBeenCalledWith('refresh_token');
      expect(userService.clearSuuntoTokens).toHaveBeenCalledTimes(1);
    });
  });

  describe('resyncActivities', () => {
    it('uses the given access token without calling getToken', async () => {
      vi.spyOn(userService, 'getSuuntoInfo');
      vi.spyOn(suuntoApi, 'getWorkouts').mockResolvedValueOnce({ payload: [], metadata: {} });
      vi.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

      const service = new SuuntoService();
      const result = await service.resyncActivities(1, 'access_token');

      expect(result).toBe(0);
      expect(userService.getSuuntoInfo).not.toHaveBeenCalled();
      expect(suuntoApi.getWorkouts).toHaveBeenCalledWith('access_token', expect.any(String));
    });

    it('throws if no valid token can be retrieved', async () => {
      vi.spyOn(userService, 'getSuuntoInfo').mockResolvedValueOnce(undefined);
      vi.spyOn(userService, 'clearSuuntoTokens').mockResolvedValueOnce(undefined);

      const service = new SuuntoService();

      await expect(service.resyncActivities(1)).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Unable to retrieve a valid Suunto token for user 1]`,
      );
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
      vi.spyOn(userRepository, 'findBySuuntoUsername').mockResolvedValueOnce(undefined);
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
      vi.spyOn(userRepository, 'findBySuuntoUsername').mockResolvedValueOnce({ c2cId: 1 });
      const getTokenSpy = vi
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
      vi.spyOn(userRepository, 'findBySuuntoUsername').mockResolvedValueOnce({ c2cId: 1 });
      const getTokenSpy = vi
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SuuntoService.prototype as any, 'getToken')
        .mockResolvedValueOnce('token');
      vi.spyOn(suuntoApi, 'getWorkoutDetails').mockRejectedValueOnce(undefined);

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
      vi.spyOn(userRepository, 'findBySuuntoUsername').mockResolvedValueOnce({ c2cId: 1 });
      const getTokenSpy = vi
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SuuntoService.prototype as any, 'getToken')
        .mockResolvedValueOnce('token');
      vi.spyOn(suuntoApi, 'getWorkoutDetails').mockResolvedValueOnce({
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
      const fit = new Uint8Array(readFileSync(resolve(__dirname, '../../../resources/mini.fit'))).buffer;
      vi.spyOn(suuntoApi, 'getFIT').mockResolvedValueOnce(fit);
      vi.spyOn(userService, 'addActivities').mockRejectedValueOnce(undefined);

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
      vi.spyOn(userRepository, 'findBySuuntoUsername').mockResolvedValueOnce({ c2cId: 1 });
      const getTokenSpy = vi
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SuuntoService.prototype as any, 'getToken')
        .mockResolvedValueOnce('token');
      vi.spyOn(suuntoApi, 'getWorkoutDetails').mockResolvedValueOnce({
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
      vi.spyOn(suuntoApi, 'getFIT').mockRejectedValueOnce(undefined);
      vi.spyOn(userService, 'addActivities');

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
      vi.spyOn(userRepository, 'findBySuuntoUsername').mockResolvedValueOnce({ c2cId: 1 });
      const getTokenSpy = vi
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SuuntoService.prototype as any, 'getToken')
        .mockResolvedValueOnce('token');
      vi.spyOn(suuntoApi, 'getWorkoutDetails').mockResolvedValueOnce({
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
      const fit = new Uint8Array(readFileSync(resolve(__dirname, '../../../resources/mini.fit'))).buffer;
      vi.spyOn(suuntoApi, 'getFIT').mockResolvedValueOnce(fit);
      vi.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

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
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);

      const service = new SuuntoService();
      await expect(service.deauthorize(1)).rejects.toMatchInlineSnapshot(`[Error: User 1 not found]`);
    });

    it('throws if token cannot be retrieved', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      const getTokenSpy = vi
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SuuntoService.prototype as any, 'getToken')
        .mockResolvedValueOnce(undefined);

      const service = new SuuntoService();
      await expect(service.deauthorize(1)).rejects.toMatchInlineSnapshot(`[Error: User 1 not found]`);

      getTokenSpy.mockRestore();
    });

    it('deauthorizes user and clears data', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({
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
      const getTokenSpy = vi
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SuuntoService.prototype as any, 'getToken')
        .mockResolvedValueOnce('token');
      vi.spyOn(suuntoApi, 'deauthorize').mockResolvedValueOnce(undefined);
      vi.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce([]);
      vi.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      vi.spyOn(userRepository, 'update').mockRejectedValueOnce(undefined);
      vi.spyOn(miniatureService, 'deleteMiniature');

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
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({
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
      const getTokenSpy = vi
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SuuntoService.prototype as any, 'getToken')
        .mockResolvedValueOnce('token');
      vi.spyOn(suuntoApi, 'deauthorize').mockResolvedValueOnce(undefined);
      vi.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockRejectedValueOnce(new Error('test'));
      vi.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      vi.spyOn(userRepository, 'update').mockRejectedValueOnce(undefined);
      vi.spyOn(miniatureService, 'deleteMiniature');

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
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({
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
      const getTokenSpy = vi
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SuuntoService.prototype as any, 'getToken')
        .mockResolvedValueOnce('token');
      vi.spyOn(suuntoApi, 'deauthorize').mockResolvedValueOnce(undefined);
      vi.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce(['miniature.png']);
      vi.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      vi.spyOn(userRepository, 'update').mockRejectedValueOnce(undefined);
      vi.spyOn(miniatureService, 'deleteMiniature').mockRejectedValueOnce(new Error('test'));

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
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({
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
      const getTokenSpy = vi
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SuuntoService.prototype as any, 'getToken')
        .mockResolvedValueOnce('token');
      vi.spyOn(suuntoApi, 'deauthorize').mockResolvedValueOnce(undefined);
      vi.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce(['miniature.png']);
      vi.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      vi.spyOn(userRepository, 'update').mockRejectedValueOnce(undefined);
      vi.spyOn(miniatureService, 'deleteMiniature').mockImplementationOnce(() => Promise.resolve());

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
