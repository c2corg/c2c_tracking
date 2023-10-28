import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import log from '../../../../src/helpers/logger.js';
import { miniatureService } from '../../../../src/miniature.service.js';
import { activityRepository } from '../../../../src/repository/activity.repository.js';
import { userRepository } from '../../../../src/repository/user.repository.js';
import { corosApi, WebhookEvent } from '../../../../src/server/coros/coros.api.js';
import { CorosService } from '../../../../src/server/coros/coros.service.js';
import { userService } from '../../../../src/user.service.js';

const FAR_FUTURE = 10000000000;

describe('Coros Service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    jest.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
    const timers = jest.useFakeTimers();
    timers.setSystemTime(new Date('1983-08-25'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('requestAccessTokenAndSetupUser', () => {
    it('calls API and setups user', async () => {
      jest
        .spyOn(corosApi, 'exchangeToken')
        .mockResolvedValueOnce({ access_token: 'access_token', refresh_token: 'refresh_token', openId: '1' });
      jest.spyOn(userService, 'configureCoros').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(corosApi, 'getWorkouts').mockResolvedValueOnce({
        result: '0000',
        message: 'OK',
        data: [
          {
            labelId: '1234',
            mode: 8,
            subMode: 1,
            startTime: 1516096869,
            endTime: 1516097362,
            startTimezone: 32,
            endTimezone: 32,
            duration: 1,
            distance: 1,
            fitUrl: 'https://oss.coros.com/fit/407419767966679040/418173292602490880.fit',
          },
        ],
      });
      const fit = readFileSync(resolve(__dirname, '../../../resources/mini.fit'));
      jest.spyOn(corosApi, 'getFIT').mockResolvedValueOnce(fit);
      jest.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

      const service = new CorosService();
      await service.requestAccessTokenAndSetupUser(1, 'code');

      expect(corosApi.exchangeToken).toHaveBeenCalledTimes(1);
      expect(corosApi.exchangeToken).toHaveBeenCalledWith('code');
      expect(userService.configureCoros).toHaveBeenCalledTimes(1);
      expect(userService.configureCoros).toHaveBeenCalledWith(1, {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        openId: '1',
      });
      expect(corosApi.getWorkouts).toHaveBeenCalledTimes(1);
      expect(corosApi.getWorkouts).toHaveBeenCalledWith('access_token', '1', 19830726, 19830825);
      expect(corosApi.getFIT).toHaveBeenCalledTimes(1);
      expect(corosApi.getFIT).toHaveBeenCalledWith(
        'https://oss.coros.com/fit/407419767966679040/418173292602490880.fit',
      );
      expect(userService.addActivities).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).toHaveBeenCalledWith(1, {
        vendor: 'coros',
        vendorId: '1234',
        type: 'Outdoor Run',
        date: '2018-01-16T18:01:09+08:00',
        length: 1,
        duration: 1,
        geojson: {
          coordinates: [
            [5.825548013672233, 44.972592014819384, 1503, 1670140122],
            [5.825552036985755, 44.97256896458566, 1503, 1670140124],
          ],
          type: 'LineString',
        },
      });
    });

    it('filters out activities without geometry', async () => {
      jest
        .spyOn(corosApi, 'exchangeToken')
        .mockResolvedValueOnce({ access_token: 'access_token', refresh_token: 'refresh_token', openId: '1' });
      jest.spyOn(userService, 'configureCoros').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(corosApi, 'getWorkouts').mockResolvedValueOnce({
        result: '0000',
        message: 'OK',
        data: [
          {
            labelId: '1234',
            mode: 8,
            subMode: 1,
            startTime: 1516096869,
            endTime: 1516097362,
            startTimezone: 32,
            endTimezone: 32,
          },
        ],
      });
      jest.spyOn(corosApi, 'getWorkoutDetails').mockResolvedValueOnce({
        result: '0000',
        message: 'OK',
        data: {
          labelId: '1234',
          mode: 8,
          subMode: 1,
          startTime: 1516096869,
          endTime: 1516097362,
          startTimezone: 32,
          endTimezone: 32,
        },
      });
      jest.spyOn(corosApi, 'getFIT');
      jest.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

      const service = new CorosService();
      await service.requestAccessTokenAndSetupUser(1, 'code');

      expect(corosApi.exchangeToken).toHaveBeenCalledTimes(1);
      expect(userService.configureCoros).toHaveBeenCalledTimes(1);
      expect(corosApi.getWorkouts).toHaveBeenCalledTimes(1);
      expect(corosApi.getWorkoutDetails).toHaveBeenCalledTimes(1);
      expect(corosApi.getFIT).not.toHaveBeenCalled();
      expect(userService.addActivities).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).toHaveBeenCalledWith(1);
    });

    it('throws if auth cannot be configured', async () => {
      jest
        .spyOn(corosApi, 'exchangeToken')
        .mockResolvedValueOnce({ access_token: 'access_token', refresh_token: 'refresh_token', openId: '1' });
      jest.spyOn(userService, 'configureCoros').mockRejectedValueOnce(new Error('test'));
      jest.spyOn(corosApi, 'getWorkouts');
      jest.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

      const service = new CorosService();
      await expect(service.requestAccessTokenAndSetupUser(1, 'code')).rejects.toThrowErrorMatchingInlineSnapshot(
        `"test"`,
      );

      expect(corosApi.exchangeToken).toHaveBeenCalledTimes(1);
      expect(userService.configureCoros).toHaveBeenCalledTimes(1);
      expect(corosApi.getWorkouts).not.toHaveBeenCalled();
      expect(userService.addActivities).not.toHaveBeenCalled();
    });

    it('logs if activity retrieval fails', async () => {
      jest
        .spyOn(corosApi, 'exchangeToken')
        .mockResolvedValueOnce({ access_token: 'access_token', refresh_token: 'refresh_token', openId: '1' });
      jest.spyOn(userService, 'configureCoros').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(corosApi, 'getWorkouts').mockImplementationOnce(() => Promise.reject());
      jest.spyOn(userService, 'addActivities');

      const service = new CorosService();
      await service.requestAccessTokenAndSetupUser(1, 'code');

      expect(corosApi.exchangeToken).toHaveBeenCalledTimes(1);
      expect(userService.configureCoros).toHaveBeenCalledTimes(1);
      expect(corosApi.getWorkouts).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).not.toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledWith(`Unable to retrieve Coros workouts for user 1`);
    });

    it('logs if activity FIT retrieval fails', async () => {
      jest
        .spyOn(corosApi, 'exchangeToken')
        .mockResolvedValueOnce({ access_token: 'access_token', refresh_token: 'refresh_token', openId: '1' });
      jest.spyOn(userService, 'configureCoros').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(corosApi, 'getWorkouts').mockResolvedValueOnce({
        result: '0000',
        message: 'OK',
        data: [
          {
            labelId: '1234',
            mode: 8,
            subMode: 1,
            startTime: 1516096869,
            endTime: 1516097362,
            startTimezone: 32,
            endTimezone: 32,
            fitUrl: 'https://coros.com/fit',
          },
        ],
      });
      jest.spyOn(corosApi, 'getFIT').mockImplementationOnce(() => Promise.reject());
      jest.spyOn(userService, 'addActivities');

      const service = new CorosService();
      await service.requestAccessTokenAndSetupUser(1, 'code');

      expect(corosApi.exchangeToken).toHaveBeenCalledTimes(1);
      expect(userService.configureCoros).toHaveBeenCalledTimes(1);
      expect(corosApi.getWorkouts).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).toHaveBeenCalledWith(1);
      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledWith(
        `Unable to retrieve Coros geometry for 1234 (https://coros.com/fit)`,
        undefined,
      );
    });

    it('logs if activity details provide no FIT URL', async () => {
      jest
        .spyOn(corosApi, 'exchangeToken')
        .mockResolvedValueOnce({ access_token: 'access_token', refresh_token: 'refresh_token', openId: '1' });
      jest.spyOn(userService, 'configureCoros').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(corosApi, 'getWorkouts').mockResolvedValueOnce({
        result: '0000',
        message: 'OK',
        data: [
          {
            labelId: '1234',
            mode: 8,
            subMode: 1,
            startTime: 1516096869,
            endTime: 1516097362,
            startTimezone: 32,
            endTimezone: 32,
          },
        ],
      });
      jest.spyOn(corosApi, 'getWorkoutDetails').mockResolvedValueOnce({
        result: '0000',
        message: 'OK',
        data: {
          labelId: '1234',
          mode: 8,
          subMode: 1,
          startTime: 1516096869,
          endTime: 1516097362,
          startTimezone: 32,
          endTimezone: 32,
        },
      });
      jest.spyOn(userService, 'addActivities');

      const service = new CorosService();
      await service.requestAccessTokenAndSetupUser(1, 'code');

      expect(corosApi.exchangeToken).toHaveBeenCalledTimes(1);
      expect(userService.configureCoros).toHaveBeenCalledTimes(1);
      expect(corosApi.getWorkouts).toHaveBeenCalledTimes(1);
      expect(corosApi.getWorkoutDetails).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).toHaveBeenCalledWith(1);
      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledWith(
        `Coros workout FIT URL couldn't be extracted from workout details for 1234`,
      );
    });

    it('logs if geometry cannot be extracted from FIT', async () => {
      jest
        .spyOn(corosApi, 'exchangeToken')
        .mockResolvedValueOnce({ access_token: 'access_token', refresh_token: 'refresh_token', openId: '1' });
      jest.spyOn(userService, 'configureCoros').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(corosApi, 'getWorkouts').mockResolvedValueOnce({
        result: '0000',
        message: 'OK',
        data: [
          {
            labelId: '1234',
            mode: 8,
            subMode: 1,
            startTime: 1516096869,
            endTime: 1516097362,
            startTimezone: 32,
            endTimezone: 32,
            duration: 1,
            distance: 1,
            fitUrl: 'https://coros.com/fit',
          },
        ],
      });
      jest.spyOn(corosApi, 'getFIT').mockResolvedValueOnce(new ArrayBuffer(1));
      jest.spyOn(userService, 'addActivities');

      const service = new CorosService();
      await service.requestAccessTokenAndSetupUser(1, 'code');

      expect(corosApi.exchangeToken).toHaveBeenCalledTimes(1);
      expect(userService.configureCoros).toHaveBeenCalledTimes(1);
      expect(corosApi.getWorkouts).toHaveBeenCalledTimes(1);
      expect(corosApi.getFIT).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).toHaveBeenCalledWith(1);
      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledWith(
        `Unable to convert Coros FIT file to geometry for 1234 (https://coros.com/fit)`,
      );
    });

    it('logs if activities cannot be saved in DB', async () => {
      jest
        .spyOn(corosApi, 'exchangeToken')
        .mockResolvedValueOnce({ access_token: 'access_token', refresh_token: 'refresh_token', openId: '1' });
      jest.spyOn(userService, 'configureCoros').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(corosApi, 'getWorkouts').mockResolvedValueOnce({
        result: '0000',
        message: 'OK',
        data: [
          {
            labelId: '1234',
            mode: 8,
            subMode: 1,
            startTime: 1516096869,
            endTime: 1516097362,
            startTimezone: 32,
            endTimezone: 32,
            duration: 1,
            distance: 1,
            fitUrl: 'https://oss.coros.com/fit/407419767966679040/418173292602490880.fit',
          },
        ],
      });
      const fit = readFileSync(resolve(__dirname, '../../../resources/mini.fit'));
      jest.spyOn(corosApi, 'getFIT').mockResolvedValueOnce(fit);
      jest.spyOn(userService, 'addActivities').mockRejectedValueOnce(undefined);

      const service = new CorosService();
      await service.requestAccessTokenAndSetupUser(1, 'code');

      expect(corosApi.exchangeToken).toHaveBeenCalledTimes(1);
      expect(userService.configureCoros).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).toHaveBeenCalledWith(1, {
        vendor: 'coros',
        vendorId: '1234',
        type: 'Outdoor Run',
        date: '2018-01-16T18:01:09+08:00',
        length: 1,
        duration: 1,
        geojson: {
          coordinates: [
            [5.825548013672233, 44.972592014819384, 1503, 1670140122],
            [5.825552036985755, 44.97256896458566, 1503, 1670140124],
          ],
          type: 'LineString',
        },
      });
      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledWith(`Unable to retrieve Coros workouts for user 1`);
    });
  });

  describe('deauthorize', () => {
    it('throws if no matching user is found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);

      const service = new CorosService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(`"User 1 not found"`);
    });

    it('throws if no matching auth exists for user', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });

      const service = new CorosService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Unable to retrieve Coros info for user 1"`,
      );
    });

    it('calls coros API then updates DB', async () => {
      jest
        .spyOn(userRepository, 'findById')
        .mockResolvedValueOnce({ c2cId: 1, coros: { id: '1', accessToken: 'token', expiresAt: FAR_FUTURE } });
      jest.spyOn(corosApi, 'deauthorize').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce([]);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));
      jest.spyOn(miniatureService, 'deleteMiniature');

      const service = new CorosService();
      await service.deauthorize(1);
      expect(corosApi.deauthorize).toHaveBeenCalledTimes(1);
      expect(corosApi.deauthorize).toHaveBeenCalledWith('token');
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'coros');
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'coros');
      expect(miniatureService.deleteMiniature).not.toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(userRepository.update).toHaveBeenCalledWith(expect.not.objectContaining({ coros: expect.anything() }));
    });

    it('warns if no miniature info could be retrieved', async () => {
      jest
        .spyOn(userRepository, 'findById')
        .mockResolvedValueOnce({ c2cId: 1, coros: { id: '1', accessToken: 'token', expiresAt: FAR_FUTURE } });
      jest.spyOn(corosApi, 'deauthorize').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockRejectedValueOnce(undefined);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));
      jest.spyOn(miniatureService, 'deleteMiniature');

      const service = new CorosService();
      await service.deauthorize(1);
      expect(corosApi.deauthorize).toHaveBeenCalledTimes(1);
      expect(corosApi.deauthorize).toHaveBeenCalledWith('token');
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'coros');
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(`Failed retrieving miniatures info for user 1 and vendor coros`);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'coros');
      expect(miniatureService.deleteMiniature).not.toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(userRepository.update).toHaveBeenCalledWith(expect.not.objectContaining({ coros: expect.anything() }));
    });

    it('warns if miniature could not be deleted', async () => {
      jest
        .spyOn(userRepository, 'findById')
        .mockResolvedValueOnce({ c2cId: 1, coros: { id: '1', accessToken: 'token', expiresAt: FAR_FUTURE } });
      jest.spyOn(corosApi, 'deauthorize').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce(['miniature.png']);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(miniatureService, 'deleteMiniature').mockImplementationOnce(() => Promise.reject());
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new CorosService();
      await service.deauthorize(1);
      expect(corosApi.deauthorize).toHaveBeenCalledTimes(1);
      expect(corosApi.deauthorize).toHaveBeenCalledWith('token');
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'coros');
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'coros');
      expect(miniatureService.deleteMiniature).toHaveBeenCalledTimes(1);
      expect(miniatureService.deleteMiniature).toHaveBeenCalledWith('miniature.png');
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(`Failed deleting miniature miniature.png`);
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(userRepository.update).toHaveBeenCalledWith(expect.not.objectContaining({ coros: expect.anything() }));
    });

    it('deletes miniatures', async () => {
      jest
        .spyOn(userRepository, 'findById')
        .mockResolvedValueOnce({ c2cId: 1, coros: { id: '1', accessToken: 'token', expiresAt: FAR_FUTURE } });
      jest.spyOn(corosApi, 'deauthorize').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce(['miniature.png']);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(miniatureService, 'deleteMiniature').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new CorosService();
      await service.deauthorize(1);
      expect(corosApi.deauthorize).toHaveBeenCalledTimes(1);
      expect(corosApi.deauthorize).toHaveBeenCalledWith('token');
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'coros');
      expect(miniatureService.deleteMiniature).toHaveBeenCalledTimes(1);
      expect(miniatureService.deleteMiniature).toHaveBeenCalledWith('miniature.png');
      expect(log.warn).not.toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(userRepository.update).toHaveBeenCalledWith(expect.not.objectContaining({ coros: expect.anything() }));
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
      jest.spyOn(corosApi, 'refreshAuth');

      const service = new CorosService();
      const result = await service['getToken']({
        c2cId: 1,
        coros: { id: '1', accessToken: 'access_token', refreshToken: 'refreshSecret', expiresAt: 62 },
      });

      expect(result).toBe('access_token');
    });

    it('refreshes access token validity if current one is expired', async () => {
      jest.spyOn(corosApi, 'refreshAuth').mockResolvedValueOnce(undefined);
      jest.spyOn(userService, 'resetCorosAuthExpiration').mockImplementationOnce(() => Promise.resolve());

      const service = new CorosService();
      const result = await service['getToken']({
        c2cId: 1,
        coros: { id: '1', accessToken: 'access_token', refreshToken: 'refresh_token', expiresAt: 61 },
      });

      expect(result).toBe('access_token');
      expect(corosApi.refreshAuth).toHaveBeenCalledTimes(1);
      expect(corosApi.refreshAuth).toHaveBeenCalledWith('refresh_token');
      expect(userService.resetCorosAuthExpiration).toHaveBeenCalledTimes(1);
      expect(userService.resetCorosAuthExpiration).toHaveBeenCalledWith(1);
    });

    it('returns undefined if refresh fails', async () => {
      jest.spyOn(corosApi, 'refreshAuth').mockRejectedValueOnce(undefined);
      jest.spyOn(userService, 'clearCorosTokens').mockResolvedValueOnce(undefined);

      const service = new CorosService();
      const result = await service['getToken']({
        c2cId: 1,
        coros: { id: '1', accessToken: 'access_token', refreshToken: 'refresh_token', expiresAt: 61 },
      });

      expect(result).toBeUndefined();
      expect(corosApi.refreshAuth).toHaveBeenCalledTimes(1);
      expect(corosApi.refreshAuth).toHaveBeenCalledWith('refresh_token');
      expect(userService.clearCorosTokens).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleWebhookEvent', () => {
    it('validates vent', async () => {
      const event: WebhookEvent = {
        sportDataList: [
          {
            openId: '1',
            labelId: '1234',
            mode: 8,
            subMode: 1,
            startTime: 1516096869,
            endTime: 1516097362,
            startTimezone: 32,
            endTimezone: 32,
          },
        ],
      };

      jest.spyOn(userRepository, 'findByCorosId');

      const service = new CorosService();
      await service.handleWebhookEvent(event, 'bad_client', 'secret');

      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledWith(`Invalid credentials for Coros wbehook event: received bad_client:secret`);
    });

    it('logs if no matching user is found', async () => {
      const event: WebhookEvent = {
        sportDataList: [
          {
            openId: '1',
            labelId: '1234',
            mode: 8,
            subMode: 1,
            startTime: 1516096869,
            endTime: 1516097362,
            startTimezone: 32,
            endTimezone: 32,
          },
        ],
      };

      jest.spyOn(userRepository, 'findByCorosId').mockResolvedValueOnce(undefined);

      const service = new CorosService();
      await service.handleWebhookEvent(
        event,
        'f263ed9257c74e808befaf548a27852c',
        '902d20cc-c2a8-4536-89a9-41e0f7626977',
      );

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        `Coros webhook event for openId 1 couldn't be processed: unable to find matching user in DB`,
      );
    });

    it('logs and ignores if FIT cannot be retrieved', async () => {
      const event: WebhookEvent = {
        sportDataList: [
          {
            openId: '1',
            labelId: '1234',
            mode: 8,
            subMode: 1,
            startTime: 1516096869,
            endTime: 1516097362,
            startTimezone: 32,
            endTimezone: 32,
            fitUrl: 'https://coros.com/fit',
          },
        ],
      };
      jest
        .spyOn(userRepository, 'findByCorosId')
        .mockResolvedValueOnce({ c2cId: 1, coros: { id: '1', accessToken: 'token', expiresAt: FAR_FUTURE } });
      jest.spyOn(corosApi, 'getFIT').mockRejectedValueOnce('error');

      const service = new CorosService();
      await service.handleWebhookEvent(
        event,
        'f263ed9257c74e808befaf548a27852c',
        '902d20cc-c2a8-4536-89a9-41e0f7626977',
      );

      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledWith(
        `Unable to retrieve Coros geometry for 1234 (https://coros.com/fit)`,
        undefined,
      );
    });

    it('logs and returns if activity cannot be saved in DB', async () => {
      const event: WebhookEvent = {
        sportDataList: [
          {
            openId: '1',
            labelId: '1234',
            mode: 8,
            subMode: 1,
            startTime: 1516096869,
            endTime: 1516097362,
            startTimezone: 32,
            endTimezone: 32,
            fitUrl: 'https://coros.com/fit',
          },
        ],
      };
      jest
        .spyOn(userRepository, 'findByCorosId')
        .mockResolvedValueOnce({ c2cId: 1, coros: { id: '1', accessToken: 'token', expiresAt: FAR_FUTURE } });
      const fit = readFileSync(resolve(__dirname, '../../../resources/mini.fit'));
      jest.spyOn(corosApi, 'getFIT').mockResolvedValueOnce(fit);
      jest.spyOn(userService, 'addActivities').mockRejectedValueOnce('error');

      const service = new CorosService();
      await service.handleWebhookEvent(
        event,
        'f263ed9257c74e808befaf548a27852c',
        '902d20cc-c2a8-4536-89a9-41e0f7626977',
      );

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        `Coros webhook event for user 1 couldn't be processed: unable to insert activity data`,
      );
    });

    it('saves activity', async () => {
      const event: WebhookEvent = {
        sportDataList: [
          {
            openId: '1',
            labelId: '1234',
            mode: 8,
            subMode: 1,
            startTime: 1516096869,
            endTime: 1516097362,
            startTimezone: 32,
            endTimezone: 32,
            duration: 1,
            distance: 1,
            fitUrl: 'https://coros.com/fit',
          },
        ],
      };
      jest
        .spyOn(userRepository, 'findByCorosId')
        .mockResolvedValueOnce({ c2cId: 1, coros: { id: '1', accessToken: 'token', expiresAt: FAR_FUTURE } });
      const fit = readFileSync(resolve(__dirname, '../../../resources/mini.fit'));
      jest.spyOn(corosApi, 'getFIT').mockResolvedValueOnce(fit);
      jest.spyOn(userService, 'addActivities').mockImplementationOnce(() => Promise.resolve());

      const service = new CorosService();
      await service.handleWebhookEvent(
        event,
        'f263ed9257c74e808befaf548a27852c',
        '902d20cc-c2a8-4536-89a9-41e0f7626977',
      );

      expect(userService.addActivities).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).toHaveBeenCalledWith(1, {
        date: '2018-01-16T18:01:09+08:00',
        duration: 1,
        geojson: {
          coordinates: [
            [5.825548013672233, 44.972592014819384, 1503, 1670140122],
            [5.825552036985755, 44.97256896458566, 1503, 1670140124],
          ],
          type: 'LineString',
        },
        length: 1,
        type: 'Outdoor Run',
        vendor: 'coros',
        vendorId: '1234',
      });
    });
  });
});
