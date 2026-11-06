import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import log from '../../../../src/helpers/logger.ts';
import { miniatureService } from '../../../../src/miniature.service.ts';
import { activityRepository } from '../../../../src/repository/activity.repository.ts';
import { stravaRepository } from '../../../../src/repository/strava.repository.ts';
import { userRepository } from '../../../../src/repository/user.repository.ts';
import { stravaApi } from '../../../../src/server/strava/strava.api.ts';
import { StravaService } from '../../../../src/server/strava/strava.service.ts';
import { userService } from '../../../../src/user.service.ts';

describe('Strava Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    vi.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
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
      vi.spyOn(stravaApi, 'exchangeToken').mockResolvedValueOnce({
        athlete: { id: 1 },
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: 1,
        expires_in: 1,
      });
      vi.spyOn(userService, 'configureStrava').mockResolvedValueOnce(undefined);
      vi.spyOn(stravaApi, 'getAthleteActivities').mockResolvedValueOnce([
        {
          id: 1,
          name: 'Morning run',
          sport_type: 'Run',
          start_date: '2022-01-01T00:00:01Z',
          start_date_local: '2022-01-01T01:00:01Z',
          distance: 1.2,
          elapsed_time: 1,
          total_elevation_gain: 1.2,
        },
      ]);
      vi.spyOn(stravaApi, 'getActivityStream').mockResolvedValueOnce({
        distance: { series_type: 'distance', original_size: 2, resolution: 'low', data: [1.0, 2.0] },
        latlng: {
          series_type: 'distance',
          original_size: 2,
          resolution: 'low',
          data: [
            [1.0, 1.0],
            [2.0, 2.0],
          ],
        },
      });
      vi.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

      const service = new StravaService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(stravaApi.exchangeToken).toHaveBeenCalledTimes(1);
      expect(stravaApi.exchangeToken).toHaveBeenCalledWith('code');
      expect(userService.configureStrava).toHaveBeenCalledTimes(1);
      expect(userService.configureStrava).toHaveBeenCalledWith(1, {
        athlete: { id: 1 },
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: 1,
        expires_in: 1,
      });
      expect(stravaApi.getAthleteActivities).toHaveBeenCalledTimes(1);
      expect(stravaApi.getAthleteActivities).toHaveBeenCalledWith('access_token');
      expect(userService.addActivities).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).toHaveBeenCalledWith(1, {
        vendor: 'strava',
        vendorId: '1',
        name: 'Morning run',
        type: 'Run',
        date: '2022-01-01T01:00:01+01:00',
        length: 1,
        duration: 1,
        geojson: {
          coordinates: [
            [1, 1],
            [2, 2],
          ],
          type: 'LineString',
        },
        heightDiffUp: 1,
      });
    });

    it('filters out activities without geometry', async () => {
      vi.spyOn(stravaApi, 'exchangeToken').mockResolvedValueOnce({
        athlete: { id: 1 },
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: 1,
        expires_in: 1,
      });
      vi.spyOn(userService, 'configureStrava').mockResolvedValueOnce(undefined);
      vi.spyOn(stravaApi, 'getAthleteActivities').mockResolvedValueOnce([
        {
          id: 1,
          name: 'Morning run',
          sport_type: 'Run',
          start_date: '2022-01-01T00:00:01Z',
          start_date_local: '2022-01-01T01:00:01Z',
          distance: 1.2,
          elapsed_time: 1,
          total_elevation_gain: 1.2,
        },
      ]);
      vi.spyOn(stravaApi, 'getActivityStream').mockResolvedValueOnce({});
      vi.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

      const service = new StravaService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(stravaApi.exchangeToken).toHaveBeenCalledTimes(1);
      expect(stravaApi.exchangeToken).toHaveBeenCalledWith('code');
      expect(userService.configureStrava).toHaveBeenCalledTimes(1);
      expect(userService.configureStrava).toHaveBeenCalledWith(1, {
        athlete: { id: 1 },
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: 1,
        expires_in: 1,
      });
      expect(stravaApi.getAthleteActivities).toHaveBeenCalledTimes(1);
      expect(stravaApi.getAthleteActivities).toHaveBeenCalledWith('access_token');
      expect(userService.addActivities).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).toHaveBeenCalledWith(1);
    });

    it('throws if auth cannot be configured', async () => {
      vi.spyOn(stravaApi, 'exchangeToken').mockResolvedValueOnce({
        athlete: { id: 1 },
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: 1,
        expires_in: 1,
      });
      vi.spyOn(userService, 'configureStrava').mockRejectedValueOnce(new Error('test'));
      vi.spyOn(stravaApi, 'getAthleteActivities');

      const service = new StravaService();
      await expect(
        service.requestShortLivedAccessTokenAndSetupUser(1, 'code'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: test]`);

      expect(userService.configureStrava).toHaveBeenCalledTimes(1);
      expect(stravaApi.getAthleteActivities).not.toHaveBeenCalled();
    });

    it('logs if activity retrieval fails', async () => {
      vi.spyOn(stravaApi, 'exchangeToken').mockResolvedValueOnce({
        athlete: { id: 1 },
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: 1,
        expires_in: 1,
      });
      vi.spyOn(userService, 'configureStrava').mockResolvedValueOnce(undefined);
      vi.spyOn(stravaApi, 'getAthleteActivities').mockRejectedValueOnce(undefined);
      vi.spyOn(userService, 'addActivities');

      const service = new StravaService();
      await service.requestShortLivedAccessTokenAndSetupUser(1, 'code');

      expect(stravaApi.getAthleteActivities).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).not.toHaveBeenCalled();
    });
  });

  describe('resyncActivities', () => {
    it('uses the given access token without calling getToken', async () => {
      vi.spyOn(userService, 'getStravaInfo');
      vi.spyOn(stravaApi, 'getAthleteActivities').mockResolvedValueOnce([]);
      vi.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

      const service = new StravaService();
      const result = await service.resyncActivities(1, 'access_token');

      expect(result).toBe(0);
      expect(userService.getStravaInfo).not.toHaveBeenCalled();
      expect(stravaApi.getAthleteActivities).toHaveBeenCalledWith('access_token');
    });

    it('falls back to getToken when no access token is given', async () => {
      vi.spyOn(userService, 'getStravaInfo').mockResolvedValueOnce({
        id: 1,
        accessToken: 'stored_access_token',
        refreshToken: 'refresh_token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });
      vi.spyOn(stravaApi, 'getAthleteActivities').mockResolvedValueOnce([
        {
          id: 1,
          name: 'Morning run',
          sport_type: 'Run',
          start_date: '2022-01-01T00:00:01Z',
          start_date_local: '2022-01-01T01:00:01Z',
          distance: 1.2,
          elapsed_time: 1,
          total_elevation_gain: 1.2,
        },
      ]);
      vi.spyOn(stravaApi, 'getActivityStream').mockResolvedValueOnce({
        distance: { series_type: 'distance', original_size: 2, resolution: 'low', data: [1.0, 2.0] },
        latlng: {
          series_type: 'distance',
          original_size: 2,
          resolution: 'low',
          data: [
            [1.0, 1.0],
            [2.0, 2.0],
          ],
        },
      });
      vi.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

      const service = new StravaService();
      const result = await service.resyncActivities(1);

      expect(result).toBe(1);
      expect(stravaApi.getAthleteActivities).toHaveBeenCalledWith('stored_access_token');
      expect(userService.addActivities).toHaveBeenCalledTimes(1);
    });

    it('throws if no valid token can be retrieved', async () => {
      vi.spyOn(userService, 'getStravaInfo').mockResolvedValueOnce(undefined);
      vi.spyOn(userService, 'clearStravaTokens').mockResolvedValueOnce(undefined);

      const service = new StravaService();

      await expect(service.resyncActivities(1)).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Unable to retrieve a valid Strava token for user 1]`,
      );
    });
  });

  describe('deauthorize', () => {
    it('throws if no matching user is found', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      vi.spyOn(userService, 'getStravaInfo');

      const service = new StravaService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: User 1 not found]`);

      expect(userService.getStravaInfo).not.toHaveBeenCalled();
    });

    it('throws if no matching auth exists for user', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      vi.spyOn(userService, 'getStravaInfo').mockResolvedValueOnce(undefined);
      vi.spyOn(userService, 'clearStravaTokens').mockResolvedValueOnce(undefined);

      const service = new StravaService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Unable to retrieve token for user 1]`,
      );

      expect(userService.getStravaInfo).toHaveBeenCalledTimes(1);
      expect(userService.getStravaInfo).toHaveBeenCalledWith(1);
      expect(userService.clearStravaTokens).toHaveBeenCalledTimes(1);
    });

    it('calls strava API then updates DB', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      vi.spyOn(userService, 'getStravaInfo').mockResolvedValueOnce({
        id: 1,
        accessToken: 'access_token',
        refreshToken: 'refreshSecret',
        expiresAt: 99999999999,
      });
      vi.spyOn(stravaApi, 'deauthorize').mockResolvedValueOnce(undefined);
      vi.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce([]);
      vi.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      vi.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));
      vi.spyOn(miniatureService, 'deleteMiniature');

      const service = new StravaService();
      await service.deauthorize(1);

      expect(userService.getStravaInfo).toHaveBeenCalledTimes(1);
      expect(userService.getStravaInfo).toHaveBeenCalledWith(1);
      expect(stravaApi.deauthorize).toHaveBeenCalledTimes(1);
      expect(stravaApi.deauthorize).toHaveBeenCalledWith('access_token');
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'strava');
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'strava');
      expect(miniatureService.deleteMiniature).not.toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(userRepository.update).toHaveBeenCalledWith(expect.not.objectContaining({ strava: expect.anything() }));
    });

    it('warns if no miniature info could be retrieved', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      vi.spyOn(userService, 'getStravaInfo').mockResolvedValueOnce({
        id: 1,
        accessToken: 'access_token',
        refreshToken: 'refreshSecret',
        expiresAt: 99999999999,
      });
      vi.spyOn(stravaApi, 'deauthorize').mockResolvedValueOnce(undefined);
      vi.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockRejectedValueOnce(new Error('test'));
      vi.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      vi.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));
      vi.spyOn(miniatureService, 'deleteMiniature');

      const service = new StravaService();
      await service.deauthorize(1);

      expect(userService.getStravaInfo).toHaveBeenCalledTimes(1);
      expect(userService.getStravaInfo).toHaveBeenCalledWith(1);
      expect(stravaApi.deauthorize).toHaveBeenCalledTimes(1);
      expect(stravaApi.deauthorize).toHaveBeenCalledWith('access_token');
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'strava');
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(`Failed retrieving miniatures info for user 1 and vendor strava`);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'strava');
      expect(miniatureService.deleteMiniature).not.toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(userRepository.update).toHaveBeenCalledWith(expect.not.objectContaining({ strava: expect.anything() }));
    });

    it('warns if miniature could not be deleted', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      vi.spyOn(userService, 'getStravaInfo').mockResolvedValueOnce({
        id: 1,
        accessToken: 'access_token',
        refreshToken: 'refreshSecret',
        expiresAt: 99999999999,
      });
      vi.spyOn(stravaApi, 'deauthorize').mockResolvedValueOnce(undefined);
      vi.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce(['miniature.png']);
      vi.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      vi.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));
      vi.spyOn(miniatureService, 'deleteMiniature').mockRejectedValueOnce(new Error('test'));

      const service = new StravaService();
      await service.deauthorize(1);

      expect(userService.getStravaInfo).toHaveBeenCalledTimes(1);
      expect(userService.getStravaInfo).toHaveBeenCalledWith(1);
      expect(stravaApi.deauthorize).toHaveBeenCalledTimes(1);
      expect(stravaApi.deauthorize).toHaveBeenCalledWith('access_token');
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'strava');
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'strava');
      expect(miniatureService.deleteMiniature).toHaveBeenCalledTimes(1);
      expect(miniatureService.deleteMiniature).toHaveBeenCalledWith('miniature.png');
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(`Failed deleting miniature miniature.png`);
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(userRepository.update).toHaveBeenCalledWith(expect.not.objectContaining({ strava: expect.anything() }));
    });

    it('deletes miniatures', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      vi.spyOn(userService, 'getStravaInfo').mockResolvedValueOnce({
        id: 1,
        accessToken: 'access_token',
        refreshToken: 'refreshSecret',
        expiresAt: 99999999999,
      });
      vi.spyOn(stravaApi, 'deauthorize').mockResolvedValueOnce(undefined);
      vi.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce(['miniature.png']);
      vi.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      vi.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));
      vi.spyOn(miniatureService, 'deleteMiniature').mockResolvedValueOnce(undefined);

      const service = new StravaService();
      await service.deauthorize(1);

      expect(userService.getStravaInfo).toHaveBeenCalledTimes(1);
      expect(userService.getStravaInfo).toHaveBeenCalledWith(1);
      expect(stravaApi.deauthorize).toHaveBeenCalledTimes(1);
      expect(stravaApi.deauthorize).toHaveBeenCalledWith('access_token');
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'strava');
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'strava');
      expect(miniatureService.deleteMiniature).toHaveBeenCalledTimes(1);
      expect(miniatureService.deleteMiniature).toHaveBeenCalledWith('miniature.png');
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(userRepository.update).toHaveBeenCalledWith(expect.not.objectContaining({ strava: expect.anything() }));
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
      vi.spyOn(userService, 'getStravaInfo').mockResolvedValueOnce({
        id: 1,
        accessToken: 'access_token',
        refreshToken: 'refreshSecret',
        expiresAt: 62,
      });
      vi.spyOn(stravaApi, 'refreshAuth');

      const service = new StravaService();
      const result = await service.getToken(1);

      expect(result).toBe('access_token');
      expect(userService.getStravaInfo).toHaveBeenCalledTimes(1);
      expect(userService.getStravaInfo).toHaveBeenCalledWith(1);
    });

    it('retrieves a new access token if current one is expired', async () => {
      vi.spyOn(userService, 'getStravaInfo').mockResolvedValueOnce({
        id: 1,
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: 61,
      });
      vi.spyOn(stravaApi, 'refreshAuth').mockResolvedValueOnce({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_at: 3600,
        expires_in: 3540,
      });
      vi.spyOn(userService, 'updateStravaAuth').mockResolvedValueOnce(undefined);

      const service = new StravaService();
      const result = await service.getToken(1);

      expect(result).toBe('new_access_token');
      expect(stravaApi.refreshAuth).toHaveBeenCalledTimes(1);
      expect(stravaApi.refreshAuth).toHaveBeenCalledWith('refresh_token');
      expect(userService.updateStravaAuth).toHaveBeenCalledTimes(1);
      expect(userService.updateStravaAuth).toHaveBeenCalledWith(1, {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_at: 3600,
        expires_in: 3540,
      });
    });

    it('returns undefined if refresh fails', async () => {
      vi.spyOn(userService, 'getStravaInfo').mockResolvedValueOnce({
        id: 1,
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: 61,
      });
      vi.spyOn(stravaApi, 'refreshAuth').mockRejectedValueOnce(undefined);
      vi.spyOn(userService, 'clearStravaTokens').mockResolvedValueOnce(undefined);

      const service = new StravaService();
      const result = await service.getToken(1);

      expect(result).toBeUndefined();
      expect(stravaApi.refreshAuth).toHaveBeenCalledTimes(1);
      expect(stravaApi.refreshAuth).toHaveBeenCalledWith('refresh_token');
      expect(userService.clearStravaTokens).toHaveBeenCalledTimes(1);
    });
  });

  describe('setupWebhook', () => {
    it('handles existing subscription', async () => {
      vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
      vi.spyOn(stravaApi, 'getSubscriptions').mockResolvedValueOnce([
        {
          id: 1,
          application_id: 1,
          created_at: '1970-01-01T00:00:01Z',
          updated_at: '1970-01-01T00:00:01Z',
          callback_url: 'http://localhost:3000/strava/webhook',
        },
      ]);
      vi.spyOn(stravaApi, 'requestSubscriptionCreation');

      const service = new StravaService();
      await service.setupWebhook();

      expect(stravaRepository.findSubscription).toHaveBeenCalledTimes(1);
      expect(stravaApi.getSubscriptions).toHaveBeenCalledTimes(1);
      expect(stravaApi.requestSubscriptionCreation).not.toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledWith('Found matching Strava webhook subscription');
    });

    it('handles no subscription', async () => {
      vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(undefined);
      vi.spyOn(stravaApi, 'getSubscriptions');
      const requestWebhookSpy = vi
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(StravaService.prototype as any, 'requestWebhookSubscription')
        .mockResolvedValueOnce(undefined);

      const service = new StravaService();
      await service.setupWebhook();

      expect(stravaRepository.findSubscription).toHaveBeenCalledTimes(1);
      expect(stravaApi.getSubscriptions).not.toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledWith('No Strava webhook subscription found in DB');
      expect(requestWebhookSpy).toHaveBeenCalledTimes(1);

      requestWebhookSpy.mockRestore();
    });

    it('handles subscription check error', async () => {
      vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
      vi.spyOn(stravaApi, 'getSubscriptions').mockRejectedValueOnce(undefined);
      const requestWebhookSpy = vi
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(StravaService.prototype as any, 'requestWebhookSubscription')
        .mockResolvedValueOnce(undefined);

      const service = new StravaService();
      await service.setupWebhook();

      expect(stravaRepository.findSubscription).toHaveBeenCalledTimes(1);
      expect(stravaApi.getSubscriptions).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        `Strava webhook subscription status couldn't be checked: unable to retrieve current subscription. Assuming not set`,
      );
      expect(requestWebhookSpy).toHaveBeenCalledTimes(1);

      requestWebhookSpy.mockRestore();
    });

    it('handles not matching strava subscription', async () => {
      vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
      vi.spyOn(stravaApi, 'getSubscriptions').mockResolvedValueOnce([
        {
          id: 1,
          application_id: 1,
          created_at: '1970-01-01T00:00:01Z',
          updated_at: '1970-01-01T00:00:01Z',
          callback_url: 'not a matching url',
        },
      ]);
      const requestWebhookSpy = vi
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(StravaService.prototype as any, 'requestWebhookSubscription')
        .mockResolvedValueOnce(undefined);

      const service = new StravaService();
      await service.setupWebhook();

      expect(stravaRepository.findSubscription).toHaveBeenCalledTimes(1);
      expect(stravaApi.getSubscriptions).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledWith('No matching Strava webhook subscription found');
      expect(requestWebhookSpy).toHaveBeenCalledTimes(1);

      requestWebhookSpy.mockRestore();
    });

    it('logs if subscription cannot be created', async () => {
      vi.spyOn(stravaApi, 'requestSubscriptionCreation').mockRejectedValueOnce(undefined);
      vi.spyOn(stravaRepository, 'setSubscription');

      const service = new StravaService();
      await service['requestWebhookSubscription']();

      expect(stravaApi.requestSubscriptionCreation).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        `Strava subscription couldn't be requested, maybe another webhook is already registered`,
      );
      expect(stravaRepository.setSubscription).not.toHaveBeenCalled();
    });

    it('logs if subscription cannot be stored in DB', async () => {
      vi.spyOn(stravaApi, 'requestSubscriptionCreation').mockResolvedValueOnce(1);
      vi.spyOn(stravaRepository, 'setSubscription').mockRejectedValueOnce(undefined);

      const service = new StravaService();
      await service['requestWebhookSubscription']();

      expect(stravaApi.requestSubscriptionCreation).toHaveBeenCalledTimes(1);
      expect(stravaRepository.setSubscription).toHaveBeenCalledTimes(1);
      expect(stravaRepository.setSubscription).toHaveBeenCalledWith(1);
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(`Strava subscription couldn't be stored in DB`);
    });

    it('creates new subscription', async () => {
      vi.spyOn(stravaApi, 'requestSubscriptionCreation').mockResolvedValueOnce(1);
      vi.spyOn(stravaRepository, 'setSubscription').mockResolvedValueOnce(undefined);

      const service = new StravaService();
      await service['requestWebhookSubscription']();

      expect(stravaApi.requestSubscriptionCreation).toHaveBeenCalledTimes(1);
      expect(stravaRepository.setSubscription).toHaveBeenCalledTimes(1);
      expect(stravaRepository.setSubscription).toHaveBeenCalledWith(1);
    });
  });

  describe('handleWebhookEvent', () => {
    it('handles invalid event', async () => {
      vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(9);

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

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(`Invalid webhook event: subscription id 1 doesn't match`);
    });

    it('ignores undesired events', async () => {
      vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);

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

      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledWith(`Not handling event athlete/update`);
    });

    describe('athlete delete event', () => {
      it('ignores if user does not match', async () => {
        vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        vi.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce(undefined);

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

        expect(log.warn).toHaveBeenCalledTimes(1);
        expect(log.warn).toHaveBeenCalledWith(
          `Strava athlete deletion webhook event for Strava user 1 couldn't be processed: unable to find matching user in DB`,
        );
      });

      it('clears user strava data', async () => {
        vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        vi.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({
          c2cId: 1,
          strava: {
            accessToken: 'access_token',
            refreshToken: 'refresh_token',
            id: 1,
            expiresAt: 1,
          },
        });
        vi.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
        vi.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

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

        expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
        expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'strava');
        expect(userRepository.update).toHaveBeenCalledTimes(1);
        expect(userRepository.update).toHaveBeenCalledWith({ c2cId: 1 });
      });
    });

    describe('activity create event', () => {
      it('logs if user does not match', async () => {
        vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        vi.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce(undefined);

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

        expect(log.warn).toHaveBeenCalledTimes(1);
        expect(log.warn).toHaveBeenCalledWith(
          `Strava activity creation webhook event for Strava user 1 couldn't be processed: unable to find matching user in DB`,
        );
      });

      it('logs if access token cannot be retrieved', async () => {
        vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        vi.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({ c2cId: 1 });
        const getTokenSpy = vi
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(StravaService.prototype as any, 'getToken')
          .mockResolvedValueOnce(undefined);

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

        expect(service.getToken).toHaveBeenCalledTimes(1);
        expect(log.warn).toHaveBeenCalledTimes(1);
        expect(log.warn).toHaveBeenCalledWith(
          `Strava activity creation webhook event for user 1 couldn't be processed: unable to acquire valid token`,
        );

        getTokenSpy.mockRestore();
      });

      it('logs if activity cannot be retrieved', async () => {
        vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        vi.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({ c2cId: 1 });
        const getTokenSpy = vi
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(StravaService.prototype as any, 'getToken')
          .mockResolvedValueOnce('access_token');
        vi.spyOn(stravaApi, 'getActivity').mockRejectedValueOnce(undefined);
        vi.spyOn(userService, 'addActivities');

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

        expect(service.getToken).toHaveBeenCalledTimes(1);
        expect(stravaApi.getActivity).toHaveBeenCalledTimes(1);
        expect(stravaApi.getActivity).toHaveBeenCalledWith('access_token', 1);
        expect(log.warn).toHaveBeenCalledTimes(1);
        expect(log.warn).toHaveBeenCalledWith(
          `Strava activity creation webhook event for user 1 couldn't be processed: unable to retrieve activity data`,
        );
        expect(userService.addActivities).not.toHaveBeenCalled();

        getTokenSpy.mockRestore();
      });

      it('logs if activity cannot be saved to DB', async () => {
        vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        vi.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({ c2cId: 1 });
        const getTokenSpy = vi
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(StravaService.prototype as any, 'getToken')
          .mockResolvedValueOnce('access_token');
        vi.spyOn(stravaApi, 'getActivity').mockResolvedValueOnce({
          id: 1,
          name: 'Morning Run',
          sport_type: 'Run',
          start_date: '1970-01-01T00:00:01Z',
          start_date_local: '1970-01-01T02:00:01Z',
          distance: 1.2,
          elapsed_time: 1,
          total_elevation_gain: 1.2,
        });
        vi.spyOn(stravaApi, 'getActivityStream').mockResolvedValueOnce({
          distance: { series_type: 'distance', original_size: 2, resolution: 'low', data: [1.0, 2.0] },
          latlng: {
            series_type: 'distance',
            original_size: 2,
            resolution: 'low',
            data: [
              [1.0, 1.0],
              [2.0, 2.0],
            ],
          },
        });
        vi.spyOn(userService, 'addActivities').mockRejectedValueOnce(undefined);

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

        expect(service.getToken).toHaveBeenCalledTimes(1);
        expect(stravaApi.getActivity).toHaveBeenCalledTimes(1);
        expect(stravaApi.getActivity).toHaveBeenCalledWith('access_token', 1);
        expect(userService.addActivities).toHaveBeenCalledTimes(1);
        expect(userService.addActivities).toHaveBeenCalledWith(1, {
          vendor: 'strava',
          vendorId: '1',
          date: '1970-01-01T02:00:01+02:00',
          name: 'Morning Run',
          type: 'Run',
          length: 1,
          duration: 1,
          geojson: {
            coordinates: [
              [1, 1],
              [2, 2],
            ],
            type: 'LineString',
          },
          heightDiffUp: 1,
        });
        expect(log.warn).toHaveBeenCalledTimes(1);
        expect(log.warn).toHaveBeenCalledWith(
          `Strava activity creation webhook event for user 1 couldn't be processed: unable to insert activity data`,
        );

        getTokenSpy.mockRestore();
      });

      it('adds activity to user', async () => {
        vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        vi.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({ c2cId: 1 });
        const getTokenSpy = vi
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(StravaService.prototype as any, 'getToken')
          .mockResolvedValueOnce('access_token');
        vi.spyOn(stravaApi, 'getActivity').mockResolvedValueOnce({
          id: 1,
          name: 'Morning Run',
          sport_type: 'Run',
          start_date: '1970-01-01T00:00:01Z',
          start_date_local: '1970-01-01T00:00:01Z',
          distance: 1.2,
          elapsed_time: 1,
          total_elevation_gain: 1.2,
        });
        vi.spyOn(stravaApi, 'getActivityStream').mockResolvedValueOnce({
          distance: { series_type: 'distance', original_size: 2, resolution: 'low', data: [1.0, 2.0] },
          latlng: {
            series_type: 'distance',
            original_size: 2,
            resolution: 'low',
            data: [
              [1.0, 1.0],
              [2.0, 2.0],
            ],
          },
        });
        vi.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

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

        expect(service.getToken).toHaveBeenCalledTimes(1);
        expect(stravaApi.getActivity).toHaveBeenCalledTimes(1);
        expect(stravaApi.getActivity).toHaveBeenCalledWith('access_token', 1);
        expect(userService.addActivities).toHaveBeenCalledTimes(1);
        expect(userService.addActivities).toHaveBeenCalledWith(1, {
          vendor: 'strava',
          vendorId: '1',
          date: '1970-01-01T00:00:01Z',
          name: 'Morning Run',
          type: 'Run',
          length: 1,
          duration: 1,
          geojson: {
            coordinates: [
              [1, 1],
              [2, 2],
            ],
            type: 'LineString',
          },
          heightDiffUp: 1,
        });
        expect(log.warn).not.toHaveBeenCalled();

        getTokenSpy.mockRestore();
      });
    });

    describe('activity update event', () => {
      it('logs if user does not match', async () => {
        vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        vi.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce(undefined);

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

        expect(log.warn).toHaveBeenCalledTimes(1);
        expect(log.warn).toHaveBeenCalledWith(
          `Strava activity update webhook event for Strava user 1 couldn't be processed: unable to find matching user in DB`,
        );
      });

      it('logs if access token cannot be retrieved', async () => {
        vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        vi.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({ c2cId: 1 });
        const getTokenSpy = vi
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(StravaService.prototype as any, 'getToken')
          .mockResolvedValueOnce(undefined);

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

        expect(service.getToken).toHaveBeenCalledTimes(1);
        expect(log.warn).toHaveBeenCalledTimes(1);
        expect(log.warn).toHaveBeenCalledWith(
          `Strava activity update webhook event for user 1 couldn't be processed: unable to acquire valid token`,
        );

        getTokenSpy.mockRestore();
      });

      it('logs if activity cannot be retrieved', async () => {
        vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        vi.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({ c2cId: 1 });
        const getTokenSpy = vi
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(StravaService.prototype as any, 'getToken')
          .mockResolvedValueOnce('access_token');
        vi.spyOn(stravaApi, 'getActivity').mockRejectedValueOnce(undefined);
        vi.spyOn(userService, 'updateActivity');

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

        expect(service.getToken).toHaveBeenCalledTimes(1);
        expect(stravaApi.getActivity).toHaveBeenCalledTimes(1);
        expect(stravaApi.getActivity).toHaveBeenCalledWith('access_token', 1);
        expect(log.warn).toHaveBeenCalledTimes(1);
        expect(log.warn).toHaveBeenCalledWith(
          `Strava activity update webhook event for user 1 couldn't be processed: unable to retrieve activity data`,
        );
        expect(userService.updateActivity).not.toHaveBeenCalled();

        getTokenSpy.mockRestore();
      });

      it('logs if activity cannot be saved to DB', async () => {
        vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        vi.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({ c2cId: 1 });
        const getTokenSpy = vi
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(StravaService.prototype as any, 'getToken')
          .mockResolvedValueOnce('access_token');
        vi.spyOn(stravaApi, 'getActivity').mockResolvedValueOnce({
          id: 1,
          name: 'Morning Run',
          sport_type: 'Run',
          start_date: '1970-01-01T00:00:01Z',
          start_date_local: '1970-01-01T00:00:01Z',
          distance: 1.2,
          elapsed_time: 1,
          total_elevation_gain: 1.2,
        });
        vi.spyOn(userService, 'updateActivity').mockRejectedValueOnce(undefined);

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

        expect(service.getToken).toHaveBeenCalledTimes(1);
        expect(stravaApi.getActivity).toHaveBeenCalledTimes(1);
        expect(stravaApi.getActivity).toHaveBeenCalledWith('access_token', 1);
        expect(userService.updateActivity).toHaveBeenCalledTimes(1);
        expect(userService.updateActivity).toHaveBeenCalledWith(1, {
          vendor: 'strava',
          vendorId: '1',
          date: '1970-01-01T00:00:01Z',
          name: 'Morning Run',
          type: 'Run',
        });
        expect(log.warn).toHaveBeenCalledTimes(1);
        expect(log.warn).toHaveBeenCalledWith(
          `Strava activity update webhook event for user 1 couldn't be processed: unable to update activity data in DB`,
        );

        getTokenSpy.mockRestore();
      });

      it('updates user activity', async () => {
        vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        vi.spyOn(userRepository, 'findByStravaId').mockResolvedValueOnce({ c2cId: 1 });
        const getTokenSpy = vi
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(StravaService.prototype as any, 'getToken')
          .mockResolvedValueOnce('access_token');
        vi.spyOn(stravaApi, 'getActivity').mockResolvedValueOnce({
          id: 1,
          name: 'Morning Run',
          sport_type: 'Run',
          start_date: '1970-01-01T00:00:01Z',
          start_date_local: '1970-01-01T00:00:01Z',
          distance: 1.2,
          elapsed_time: 1,
          total_elevation_gain: 1.2,
        });
        vi.spyOn(userService, 'updateActivity');

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

        expect(service.getToken).toHaveBeenCalledTimes(1);
        expect(stravaApi.getActivity).toHaveBeenCalledTimes(1);
        expect(stravaApi.getActivity).toHaveBeenCalledWith('access_token', 1);
        expect(userService.updateActivity).toHaveBeenCalledTimes(1);
        expect(userService.updateActivity).toHaveBeenCalledWith(1, {
          vendor: 'strava',
          vendorId: '1',
          date: '1970-01-01T00:00:01Z',
          name: 'Morning Run',
          type: 'Run',
        });
        expect(log.warn).not.toHaveBeenCalled();

        getTokenSpy.mockRestore();
      });
    });

    describe('activity delete event', () => {
      it('logs if activity could not be deleted', async () => {
        vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        vi.spyOn(userService, 'deleteActivity').mockRejectedValueOnce(undefined);

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

        expect(userService.deleteActivity).toHaveBeenCalledTimes(1);
        expect(userService.deleteActivity).toHaveBeenCalledWith('strava', '1');
        expect(log.warn).toHaveBeenCalledTimes(1);
        expect(log.warn).toHaveBeenCalledWith(
          `Strava activity delete webhook event for activity 1 couldn't be processed: unable to delete activity data in DB`,
        );
      });

      it('deletes activity', async () => {
        vi.spyOn(stravaRepository, 'findSubscription').mockResolvedValueOnce(1);
        vi.spyOn(userService, 'deleteActivity').mockResolvedValueOnce(undefined);

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

        expect(userService.deleteActivity).toHaveBeenCalledTimes(1);
        expect(userService.deleteActivity).toHaveBeenCalledWith('strava', '1');
        expect(log.warn).not.toHaveBeenCalled();
      });
    });
  });

  describe('streamSetToGeoJSON', () => {
    it('throws if streamset has no distance stream', () => {
      const service = new StravaService();
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (service as any).streamSetToGeoJSON(
          [
            {
              type: 'time',
              series_type: 'time',
              original_size: 2,
              resolution: 'high',
              data: [1, 2],
            },

            {
              type: 'latlng',
              series_type: 'time',
              original_size: 2,
              resolution: 'high',
              data: [
                [1.0, 1.0],
                [2.0, 2.0],
              ],
            },
          ],
          1,
        );
      }).toThrowErrorMatchingInlineSnapshot(`[Error: Available data cannot be converted to a valid geometry]`);
    });

    it('throws if streamset has no latlng stream', () => {
      const service = new StravaService();
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (service as any).streamSetToGeoJSON(
          {
            time: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [1, 2],
            },

            distance: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [1, 2],
            },
          },
          1,
        );
      }).toThrowErrorMatchingInlineSnapshot(`[Error: Available data cannot be converted to a valid geometry]`);
    });

    it('throws if streams are not all synchronized with distance stream', () => {
      const service = new StravaService();
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (service as any).streamSetToGeoJSON(
          {
            distance: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [1, 2],
            },

            time: {
              series_type: 'time',
              original_size: 2,
              resolution: 'high',
              data: [1, 2],
            },

            latlng: {
              series_type: 'time',
              original_size: 2,
              resolution: 'high',
              data: [
                [1.0, 1.0],
                [2.0, 2.0],
              ],
            },
          },
          1,
        );
      }).toThrowErrorMatchingInlineSnapshot(`[Error: Available data cannot be converted to a valid geometry]`);
    });

    it('throws if streams are not all of same size', () => {
      const service = new StravaService();
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (service as any).streamSetToGeoJSON(
          {
            distance: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [1, 2],
            },

            time: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [1, 2],
            },

            latlng: {
              series_type: 'distance',
              original_size: 1,
              resolution: 'high',
              data: [[1.0, 1.0]],
            },
          },
          1,
        );
      }).toThrowErrorMatchingInlineSnapshot(`[Error: Available data cannot be converted to a valid geometry]`);
    });

    it('converts streamset to geojson', () => {
      const service = new StravaService();
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (service as any).streamSetToGeoJSON(
          {
            distance: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [1, 2],
            },

            time: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [1, 2],
            },

            latlng: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [
                [1.0, 1.0],
                [2.0, 2.0],
              ],
            },

            altitude: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [1, 2],
            },
          },
          1,
        ),
      ).toMatchInlineSnapshot(`
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

    it('converts streamset to geojson without altitude', () => {
      const service = new StravaService();
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (service as any).streamSetToGeoJSON(
          {
            distance: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [1, 2],
            },

            time: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [1, 2],
            },

            latlng: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [
                [1.0, 1.0],
                [2.0, 2.0],
              ],
            },
          },
          1,
        ),
      ).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              1,
              1,
              2,
            ],
            [
              2,
              2,
              3,
            ],
          ],
          "type": "LineString",
        }
      `);
    });

    it('converts streamset to geojson without timestamp', () => {
      const service = new StravaService();
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (service as any).streamSetToGeoJSON(
          {
            distance: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [1, 2],
            },

            latlng: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [
                [1.0, 1.0],
                [2.0, 2.0],
              ],
            },

            altitude: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [1, 2],
            },
          },
          1,
        ),
      ).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              1,
              1,
              1,
            ],
            [
              2,
              2,
              2,
            ],
          ],
          "type": "LineString",
        }
      `);
    });

    it('converts streamset to geojson without timestamp and altitude', () => {
      const service = new StravaService();
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (service as any).streamSetToGeoJSON(
          {
            distance: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [1, 2],
            },

            latlng: {
              series_type: 'distance',
              original_size: 2,
              resolution: 'high',
              data: [
                [1.0, 1.0],
                [2.0, 2.0],
              ],
            },
          },
          1,
        ),
      ).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              1,
              1,
            ],
            [
              2,
              2,
            ],
          ],
          "type": "LineString",
        }
      `);
    });
  });

  // activities without GPS track are common (indoor, manual entries): no warning for them
  describe('activity geometry', () => {
    it('is undefined, without warning, for an activity without stream', async () => {
      vi.spyOn(stravaApi, 'getActivityStream').mockResolvedValueOnce(undefined);

      const service = new StravaService();

      await expect(service['retrieveActivityGeometry']('token', 1, '2022-01-01T01:00:01Z')).resolves.toBeUndefined();
      expect(log.warn).not.toHaveBeenCalled();
    });

    it('is undefined, without warning, for a stream without coordinates', async () => {
      vi.spyOn(stravaApi, 'getActivityStream').mockResolvedValueOnce({});

      const service = new StravaService();

      await expect(service['retrieveActivityGeometry']('token', 1, '2022-01-01T01:00:01Z')).resolves.toBeUndefined();
      expect(log.warn).not.toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledWith(
        { err: new Error('Available data cannot be converted to a valid geometry') },
        'Unable to retrieve Strava geometry for 1',
      );
    });
  });
});
