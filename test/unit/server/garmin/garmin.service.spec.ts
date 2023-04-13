import log from '../../../../src/helpers/logger.js';
import { miniatureService } from '../../../../src/miniature.service.js';
import { activityRepository } from '../../../../src/repository/activity.repository.js';
import { userRepository } from '../../../../src/repository/user.repository.js';
import { garminApi, type GarminAuth } from '../../../../src/server/garmin/garmin.api.js';
import { GarminService } from '../../../../src/server/garmin/garmin.service.js';
import { userService } from '../../../../src/user.service.js';

describe('Garmin service', () => {
  beforeEach(() => {
    jest.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    jest.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('requestUnauthorizedRequestToken', () => {
    it('calls garmin API', async () => {
      const auth: GarminAuth = {
        token: 'token',
        tokenSecret: 'tokenSecret',
      };
      jest.spyOn(garminApi, 'requestUnauthorizedRequestToken').mockResolvedValueOnce(auth);

      const service = new GarminService();
      expect(await service.requestUnauthorizedRequestToken()).toEqual(auth);
    });
  });

  describe('requestAccessTokenAndSetupUser', () => {
    it('calls garmin API and setups user', async () => {
      jest.spyOn(garminApi, 'exchangeToken').mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });
      jest.spyOn(userService, 'configureGarmin').mockResolvedValueOnce(undefined);
      jest.spyOn(garminApi, 'backfillActivities').mockResolvedValueOnce();
      jest.spyOn(userService, 'addActivities').mockImplementationOnce(() => Promise.resolve());

      const service = new GarminService();
      await service.requestAccessTokenAndSetupUser(1, 'requestToken', 'requestTokenSecret', 'verifier');

      expect(garminApi.exchangeToken).toHaveBeenCalledTimes(1);
      expect(garminApi.exchangeToken).toHaveBeenCalledWith('requestToken', 'requestTokenSecret', 'verifier');
      expect(userService.configureGarmin).toHaveBeenCalledTimes(1);
      expect(userService.configureGarmin).toHaveBeenCalledWith(1, { token: 'token', tokenSecret: 'tokenSecret' });
      expect(garminApi.backfillActivities).toHaveBeenCalledTimes(1);
    });

    it('throws if auth cannot be configured', async () => {
      jest.spyOn(garminApi, 'exchangeToken').mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });
      jest.spyOn(userService, 'configureGarmin').mockRejectedValueOnce(new Error('test'));

      const service = new GarminService();
      await expect(
        service.requestAccessTokenAndSetupUser(1, 'requestToken', 'requestTokenSecret', 'verifier'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"test"`);
    });
  });

  describe('getAuth', () => {
    it('call garmin API', async () => {
      jest.spyOn(userService, 'getGarminInfo').mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });

      const service = new GarminService();
      const result = await service.getAuth(1);

      expect(result).toMatchInlineSnapshot(`
        {
          "token": "token",
          "tokenSecret": "tokenSecret",
        }
      `);
      expect(userService.getGarminInfo).toHaveBeenCalledTimes(1);
      expect(userService.getGarminInfo).toHaveBeenCalledWith(1);
    });
  });

  describe('deauthorize', () => {
    it('throws if no matching user is found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userService, 'getGarminInfo');

      const service = new GarminService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(`"User 1 not found"`);

      expect(userService.getGarminInfo).not.toHaveBeenCalled();
    });

    it('throws if no matching auth exists for user', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userService, 'getGarminInfo').mockResolvedValueOnce(undefined);

      const service = new GarminService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(`"User 1 not found"`);

      expect(userService.getGarminInfo).toHaveBeenCalledTimes(1);
      expect(userService.getGarminInfo).toHaveBeenCalledWith(1);
    });

    it('calls garmin API then updates DB', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userService, 'getGarminInfo').mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });
      jest.spyOn(garminApi, 'deauthorize').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce([]);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));
      jest.spyOn(miniatureService, 'deleteMiniature');

      const service = new GarminService();
      await service.deauthorize(1);

      expect(userService.getGarminInfo).toHaveBeenCalledTimes(1);
      expect(userService.getGarminInfo).toHaveBeenCalledWith(1);
      expect(garminApi.deauthorize).toHaveBeenCalledTimes(1);
      expect(garminApi.deauthorize).toHaveBeenCalledWith('token', 'tokenSecret');
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'garmin');
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'garmin');
      expect(miniatureService.deleteMiniature).not.toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(userRepository.update).toHaveBeenCalledWith(expect.not.objectContaining({ garmin: expect.anything() }));
    });

    it('warns if no miniature info could be retrieved', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userService, 'getGarminInfo').mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });
      jest.spyOn(garminApi, 'deauthorize').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockRejectedValueOnce(undefined);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));
      jest.spyOn(miniatureService, 'deleteMiniature');

      const service = new GarminService();
      await service.deauthorize(1);

      expect(userService.getGarminInfo).toHaveBeenCalledTimes(1);
      expect(userService.getGarminInfo).toHaveBeenCalledWith(1);
      expect(garminApi.deauthorize).toHaveBeenCalledTimes(1);
      expect(garminApi.deauthorize).toHaveBeenCalledWith('token', 'tokenSecret');
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'garmin');
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(`Failed retrieving miniatures info for user 1 and vendor garmin`);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'garmin');
      expect(miniatureService.deleteMiniature).not.toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(userRepository.update).toHaveBeenCalledWith(expect.not.objectContaining({ garmin: expect.anything() }));
    });

    it('warns if miniature could not be deleted', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userService, 'getGarminInfo').mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });
      jest.spyOn(garminApi, 'deauthorize').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce(['miniature.png']);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));
      jest.spyOn(miniatureService, 'deleteMiniature').mockImplementationOnce(() => Promise.reject());

      const service = new GarminService();
      await service.deauthorize(1);

      expect(userService.getGarminInfo).toHaveBeenCalledTimes(1);
      expect(userService.getGarminInfo).toHaveBeenCalledWith(1);
      expect(garminApi.deauthorize).toHaveBeenCalledTimes(1);
      expect(garminApi.deauthorize).toHaveBeenCalledWith('token', 'tokenSecret');
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'garmin');
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'garmin');
      expect(miniatureService.deleteMiniature).toHaveBeenCalledTimes(1);
      expect(miniatureService.deleteMiniature).toHaveBeenCalledWith('miniature.png');
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(`Failed deleting miniature miniature.png`);
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(userRepository.update).toHaveBeenCalledWith(expect.not.objectContaining({ garmin: expect.anything() }));
    });

    it('deletes miniatures', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userService, 'getGarminInfo').mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });
      jest.spyOn(garminApi, 'deauthorize').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce(['miniature.png']);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));
      jest.spyOn(miniatureService, 'deleteMiniature').mockImplementationOnce(() => Promise.resolve());

      const service = new GarminService();
      await service.deauthorize(1);

      expect(userService.getGarminInfo).toHaveBeenCalledTimes(1);
      expect(userService.getGarminInfo).toHaveBeenCalledWith(1);
      expect(garminApi.deauthorize).toHaveBeenCalledTimes(1);
      expect(garminApi.deauthorize).toHaveBeenCalledWith('token', 'tokenSecret');
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'garmin');
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'garmin');
      expect(miniatureService.deleteMiniature).toHaveBeenCalledTimes(1);
      expect(miniatureService.deleteMiniature).toHaveBeenCalledWith('miniature.png');
      expect(log.warn).not.toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(userRepository.update).toHaveBeenCalledWith(expect.not.objectContaining({ garmin: expect.anything() }));
    });
  });

  describe('handleActivityWebhook', () => {
    it('adds activities for each user', async () => {
      jest
        .spyOn(userRepository, 'findByGarminToken')
        .mockResolvedValueOnce({ c2cId: 1 })
        .mockResolvedValueOnce({ c2cId: 2 });
      jest.spyOn(userService, 'addActivities').mockImplementation(() => Promise.resolve());

      const service = new GarminService();
      await service.handleActivityWebhook([
        {
          userId: '1',
          userAccessToken: 'user1Token',
          activityId: 1,
          summary: { activityType: 'RUNNING', startTimeInSeconds: 1, startTimeOffsetInSeconds: 0 },
          samples: [
            { latitudeInDegree: 1.0, longitudeInDegree: 1.0, startTimeInSeconds: 1 },
            { latitudeInDegree: 2.0, longitudeInDegree: 2.0, startTimeInSeconds: 2 },
          ],
        },
        {
          userId: '2',
          userAccessToken: 'user2Token',
          activityId: 2,
          summary: {
            activityType: 'BACKCOUNTRY SKIING/SNOWBOARDING',
            startTimeInSeconds: 1,
            startTimeOffsetInSeconds: 0,
          },
          samples: [
            { latitudeInDegree: 1.0, longitudeInDegree: 1.0, startTimeInSeconds: 1 },
            { latitudeInDegree: 2.0, longitudeInDegree: 2.0, startTimeInSeconds: 2 },
          ],
        },
      ]);

      expect(userRepository.findByGarminToken).toHaveBeenCalledTimes(2);
      expect(userRepository.findByGarminToken).toHaveBeenNthCalledWith(1, 'user1Token');
      expect(userRepository.findByGarminToken).toHaveBeenNthCalledWith(2, 'user2Token');
      expect(userService.addActivities).toHaveBeenCalledTimes(2);
      expect(userService.addActivities).toHaveBeenNthCalledWith(1, 1, {
        date: '1970-01-01T00:00:01Z',
        geojson: {
          coordinates: [
            [1, 1, 0],
            [2, 2, 0],
          ],
          type: 'LineString',
        },
        type: 'RUNNING',
        vendor: 'garmin',
        vendorId: '1',
      });
      expect(userService.addActivities).toHaveBeenNthCalledWith(2, 2, {
        date: '1970-01-01T00:00:01Z',
        geojson: {
          coordinates: [
            [1, 1, 0],
            [2, 2, 0],
          ],
          type: 'LineString',
        },
        type: 'BACKCOUNTRY SKIING/SNOWBOARDING',
        vendor: 'garmin',
        vendorId: '2',
      });
    });

    it('filters out activities without samples', async () => {
      jest.spyOn(userRepository, 'findByGarminToken').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userService, 'addActivities');

      const service = new GarminService();
      await service.handleActivityWebhook([
        {
          userId: '1',
          userAccessToken: 'user1Token',
          activityId: 1,
          summary: { activityType: 'RUNNING', startTimeInSeconds: 1, startTimeOffsetInSeconds: 0 },
        },
      ]);

      expect(userRepository.findByGarminToken).toHaveBeenCalledTimes(1);
      expect(userRepository.findByGarminToken).toHaveBeenCalledWith('user1Token');
      expect(userService.addActivities).not.toHaveBeenCalled();
    });

    it('logs and returns if user for activity cannot be found', async () => {
      jest.spyOn(userRepository, 'findByGarminToken').mockResolvedValueOnce(undefined);
      jest.spyOn(userService, 'addActivities');

      const service = new GarminService();
      await service.handleActivityWebhook([
        {
          userId: '1',
          userAccessToken: 'user1TokenNotMatchingInDb',
          activityId: 1,
          summary: { activityType: 'RUNNING', startTimeInSeconds: 1, startTimeOffsetInSeconds: 0 },
        },
      ]);

      expect(userService.addActivities).not.toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        `Garmin activity webhook event for Garmin token user1TokenNotMatchingInDb couldn't be processed: unable to find matching user in DB`,
      );
    });

    it(`logs if some activities couldn't be stored in db`, async () => {
      jest.spyOn(userRepository, 'findByGarminToken').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userService, 'addActivities').mockRejectedValueOnce(undefined);

      const service = new GarminService();
      await service.handleActivityWebhook([
        {
          userId: '1',
          userAccessToken: 'user1TokenNotMatchingInDb',
          activityId: 1,
          summary: { activityType: 'RUNNING', startTimeInSeconds: 1, startTimeOffsetInSeconds: 0 },
          samples: [
            { latitudeInDegree: 1.0, longitudeInDegree: 1.0, startTimeInSeconds: 1 },
            { latitudeInDegree: 2.0, longitudeInDegree: 2.0, startTimeInSeconds: 2 },
          ],
        },
      ]);

      expect(userService.addActivities).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        `Garmin activity creation webhook event for user 1 couldn't be processed: unable to insert activity data`,
      );
    });
  });

  describe('handleDeauthorizeWebhook', () => {
    it('calls garmin API then cleans DB', async () => {
      jest
        .spyOn(userRepository, 'findByGarminToken')
        .mockResolvedValueOnce({ c2cId: 1 })
        .mockResolvedValueOnce({ c2cId: 2 });
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementation(() => Promise.resolve());
      jest.spyOn(userRepository, 'update').mockImplementation((user) => Promise.resolve(user));

      const service = new GarminService();
      await service.handleDeauthorizeWebhook([
        { userId: 'user1', userAccessToken: 'user1AccessToken' },
        { userId: 'user2', userAccessToken: 'user2AccessToken' },
      ]);

      expect(userRepository.findByGarminToken).toHaveBeenCalledTimes(2);
      expect(userRepository.findByGarminToken).toHaveBeenNthCalledWith(1, 'user1AccessToken');
      expect(userRepository.findByGarminToken).toHaveBeenNthCalledWith(2, 'user2AccessToken');
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(2);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenNthCalledWith(1, 1, 'garmin');
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenNthCalledWith(2, 2, 'garmin');
      expect(userRepository.update).toHaveBeenCalledTimes(2);
      expect(userRepository.update).toHaveBeenNthCalledWith(1, { c2cId: 1 });
      expect(userRepository.update).toHaveBeenNthCalledWith(2, { c2cId: 2 });
    });

    it('logs if matching user is not found', async () => {
      jest.spyOn(userRepository, 'findByGarminToken').mockResolvedValueOnce(undefined);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor');
      jest.spyOn(userRepository, 'update');

      const service = new GarminService();
      await service.handleDeauthorizeWebhook([{ userId: 'user1', userAccessToken: 'user1AccessToken' }]);

      expect(userRepository.findByGarminToken).toHaveBeenCalledTimes(1);
      expect(userRepository.findByGarminToken).toHaveBeenCalledWith('user1AccessToken');
      expect(activityRepository.deleteByUserAndVendor).not.toHaveBeenCalled();
      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });
});
