import log from '../../../../src/helpers/logger';
import { activityRepository } from '../../../../src/repository/activity.repository';
import { userRepository } from '../../../../src/repository/user.repository';
import { garminApi, type GarminAuth } from '../../../../src/server/garmin/garmin.api';
import { GarminService } from '../../../../src/server/garmin/garmin.service';
import { userService } from '../../../../src/user.service';

describe('Garmin service', () => {
  beforeEach(() => {
    jest.spyOn(log, 'info').mockImplementation(() => Promise.resolve());
    jest.spyOn(log, 'warn').mockImplementation(() => Promise.resolve());
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
      jest
        .spyOn(garminApi, 'getActivitiesForDay')
        .mockResolvedValueOnce([
          {
            activityId: 1,
            summary: {
              activityType: 'RUNNING',
              startTimeInSeconds: 1,
              startTimeOffsetInSeconds: -3600,
              distanceInMeters: 1.2,
              durationInSeconds: 1,
              totalElevationGainInMeters: 1.2,
            },
            samples: [
              {
                latitudeInDegree: 1.0,
                longitudeInDegree: 1.0,
                elevationInMeters: 200,
                startTimeInSeconds: 1,
              },
              {
                latitudeInDegree: 2.0,
                longitudeInDegree: 2.0,
                elevationInMeters: 200,
                startTimeInSeconds: 2,
              },
            ],
          },
        ])
        .mockResolvedValue([]);
      jest.spyOn(userService, 'addActivities').mockImplementationOnce(() => Promise.resolve());

      const service = new GarminService();
      await service.requestAccessTokenAndSetupUser(1, 'requestToken', 'requestTokenSecret', 'verifier');

      expect(garminApi.exchangeToken).toBeCalledTimes(1);
      expect(garminApi.exchangeToken).toBeCalledWith('requestToken', 'requestTokenSecret', 'verifier');
      expect(userService.configureGarmin).toBeCalledTimes(1);
      expect(userService.configureGarmin).toBeCalledWith(1, { token: 'token', tokenSecret: 'tokenSecret' });
      expect(userService.addActivities).toBeCalledTimes(1);
      expect(userService.addActivities).toBeCalledWith(1, {
        vendor: 'garmin',
        vendorId: '1',
        date: '1969-12-31T23:00:01-01:00',
        type: 'RUNNING',
        length: 1,
        duration: 1,
        heightDiffUp: 1,
        geojson: {
          type: 'LineString',
          coordinates: [
            [1, 1, 200, 1],
            [2, 2, 200, 2],
          ],
        },
      });
    });

    it('throws if auth cannot be configured', async () => {
      jest.spyOn(garminApi, 'exchangeToken').mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });
      jest.spyOn(userService, 'configureGarmin').mockRejectedValueOnce(new Error('test'));

      const service = new GarminService();
      await expect(
        service.requestAccessTokenAndSetupUser(1, 'requestToken', 'requestTokenSecret', 'verifier'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"test"`);
    });

    it('warns if an activity retrieval fails', async () => {
      jest.spyOn(garminApi, 'exchangeToken').mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });
      jest.spyOn(userService, 'configureGarmin').mockResolvedValueOnce(undefined);
      jest.spyOn(garminApi, 'getActivitiesForDay').mockRejectedValue(undefined);
      jest.spyOn(userService, 'addActivities').mockImplementationOnce(() => Promise.resolve());

      const service = new GarminService();
      await service.requestAccessTokenAndSetupUser(1, 'requestToken', 'requestTokenSecret', 'verifier');

      expect(userService.addActivities).not.toBeCalled();
      expect(log.warn).toBeCalledTimes(8);
    });

    it('computes GeoJSON and returns undefined if samples are absent', async () => {
      jest.spyOn(garminApi, 'exchangeToken').mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });
      jest.spyOn(userService, 'configureGarmin').mockResolvedValueOnce(undefined);
      jest
        .spyOn(garminApi, 'getActivitiesForDay')
        .mockResolvedValueOnce([
          {
            activityId: 1,
            summary: {
              activityType: 'RUNNING',
              startTimeInSeconds: 1,
              startTimeOffsetInSeconds: 0,
            },
          },
        ])
        .mockResolvedValue([]);
      jest.spyOn(userService, 'addActivities');

      const service = new GarminService();
      await service.requestAccessTokenAndSetupUser(1, 'requestToken', 'requestTokenSecret', 'verifier');

      expect(userService.addActivities).not.toBeCalled();
    });

    it('computes GeoJSON and returns undefined if samples are empty', async () => {
      jest.spyOn(garminApi, 'exchangeToken').mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });
      jest.spyOn(userService, 'configureGarmin').mockResolvedValueOnce(undefined);
      jest
        .spyOn(garminApi, 'getActivitiesForDay')
        .mockResolvedValueOnce([
          {
            activityId: 1,
            summary: {
              activityType: 'RUNNING',
              startTimeInSeconds: 1,
              startTimeOffsetInSeconds: 0,
            },
            samples: [],
          },
        ])
        .mockResolvedValue([]);
      jest.spyOn(userService, 'addActivities');

      const service = new GarminService();
      await service.requestAccessTokenAndSetupUser(1, 'requestToken', 'requestTokenSecret', 'verifier');

      expect(userService.addActivities).not.toBeCalled();
    });

    it('computes GeoJSON and returns undefined if samples are all filtered out', async () => {
      jest.spyOn(garminApi, 'exchangeToken').mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });
      jest.spyOn(userService, 'configureGarmin').mockResolvedValueOnce(undefined);
      jest
        .spyOn(garminApi, 'getActivitiesForDay')
        .mockResolvedValueOnce([
          {
            activityId: 1,
            summary: {
              activityType: 'RUNNING',
              startTimeInSeconds: 1,
              startTimeOffsetInSeconds: 0,
            },
            samples: [
              {
                latitudeInDegree: 1.0,
                startTimeInSeconds: 1,
              },
            ],
          },
        ])
        .mockResolvedValue([]);
      jest.spyOn(userService, 'addActivities');

      const service = new GarminService();
      await service.requestAccessTokenAndSetupUser(1, 'requestToken', 'requestTokenSecret', 'verifier');

      expect(userService.addActivities).not.toBeCalled();
    });

    it('computes GeoJSON and filters out samples missing coordinates', async () => {
      jest.spyOn(garminApi, 'exchangeToken').mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });
      jest.spyOn(userService, 'configureGarmin').mockResolvedValueOnce(undefined);
      jest
        .spyOn(garminApi, 'getActivitiesForDay')
        .mockResolvedValueOnce([
          {
            activityId: 1,
            summary: {
              activityType: 'RUNNING',
              startTimeInSeconds: 1,
              startTimeOffsetInSeconds: 0,
            },
            samples: [
              {
                latitudeInDegree: 1.0,
                longitudeInDegree: 1.0,
                startTimeInSeconds: 1,
              },
              {
                latitudeInDegree: 1.0,
                startTimeInSeconds: 2,
              },
              {
                longitudeInDegree: 1.0,
                startTimeInSeconds: 3,
              },
              {
                startTimeInSeconds: 4,
              },
            ],
          },
        ])
        .mockResolvedValue([]);
      jest.spyOn(userService, 'addActivities').mockImplementationOnce(() => Promise.resolve());

      const service = new GarminService();
      await service.requestAccessTokenAndSetupUser(1, 'requestToken', 'requestTokenSecret', 'verifier');

      expect(userService.addActivities).toBeCalledTimes(1);
      expect(userService.addActivities).toBeCalledWith(1, {
        vendor: 'garmin',
        vendorId: '1',
        date: '1970-01-01T00:00:01Z',
        type: 'RUNNING',
        geojson: { type: 'LineString', coordinates: [[1, 1, 0]] },
      });
    });

    it('computes GeoJSON and handles no elevation', async () => {
      jest.spyOn(garminApi, 'exchangeToken').mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });
      jest.spyOn(userService, 'configureGarmin').mockResolvedValueOnce(undefined);
      jest
        .spyOn(garminApi, 'getActivitiesForDay')
        .mockResolvedValueOnce([
          {
            activityId: 1,
            summary: {
              activityType: 'RUNNING',
              startTimeInSeconds: 1,
              startTimeOffsetInSeconds: 0,
            },
            samples: [
              {
                latitudeInDegree: 1.0,
                longitudeInDegree: 1.0,
                startTimeInSeconds: 1,
              },
              {
                latitudeInDegree: 2.0,
                longitudeInDegree: 2.0,
                startTimeInSeconds: 2,
              },
            ],
          },
        ])
        .mockResolvedValue([]);
      jest.spyOn(userService, 'addActivities').mockImplementationOnce(() => Promise.resolve());

      const service = new GarminService();
      await service.requestAccessTokenAndSetupUser(1, 'requestToken', 'requestTokenSecret', 'verifier');

      expect(userService.addActivities).toBeCalledTimes(1);
      expect(userService.addActivities).toBeCalledWith(1, {
        vendor: 'garmin',
        vendorId: '1',
        date: '1970-01-01T00:00:01Z',
        type: 'RUNNING',
        geojson: {
          type: 'LineString',
          coordinates: [
            [1, 1, 0],
            [2, 2, 0],
          ],
        },
      });
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
      expect(userService.getGarminInfo).toBeCalledTimes(1);
      expect(userService.getGarminInfo).toBeCalledWith(1);
    });
  });

  describe('deauthorize', () => {
    it('throws if no matching user is found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userService, 'getGarminInfo');

      const service = new GarminService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(`"User 1 not found"`);

      expect(userService.getGarminInfo).not.toBeCalled();
    });

    it('throws if no matching auth exists for user', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userService, 'getGarminInfo').mockResolvedValueOnce(undefined);

      const service = new GarminService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(`"User 1 not found"`);

      expect(userService.getGarminInfo).toBeCalledTimes(1);
      expect(userService.getGarminInfo).toBeCalledWith(1);
    });

    it('calls garmin API then updates DB', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userService, 'getGarminInfo').mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });
      jest.spyOn(garminApi, 'deauthorize').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new GarminService();
      await service.deauthorize(1);

      expect(userService.getGarminInfo).toBeCalledTimes(1);
      expect(userService.getGarminInfo).toBeCalledWith(1);
      expect(garminApi.deauthorize).toBeCalledTimes(1);
      expect(garminApi.deauthorize).toBeCalledWith('token', 'tokenSecret');
      expect(activityRepository.deleteByUserAndVendor).toBeCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toBeCalledWith(1, 'garmin');
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith(expect.not.objectContaining({ garmin: expect.anything() }));
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

      expect(userRepository.findByGarminToken).toBeCalledTimes(2);
      expect(userRepository.findByGarminToken).nthCalledWith(1, 'user1Token');
      expect(userRepository.findByGarminToken).nthCalledWith(2, 'user2Token');
      expect(userService.addActivities).toBeCalledTimes(2);
      expect(userService.addActivities).nthCalledWith(1, 1, {
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
      expect(userService.addActivities).nthCalledWith(2, 2, {
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

      expect(userRepository.findByGarminToken).toBeCalledTimes(1);
      expect(userRepository.findByGarminToken).toBeCalledWith('user1Token');
      expect(userService.addActivities).not.toBeCalled();
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

      expect(userService.addActivities).not.toBeCalled();
      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
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

      expect(userService.addActivities).toBeCalledTimes(1);
      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
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

      expect(userRepository.findByGarminToken).toBeCalledTimes(2);
      expect(userRepository.findByGarminToken).nthCalledWith(1, 'user1AccessToken');
      expect(userRepository.findByGarminToken).nthCalledWith(2, 'user2AccessToken');
      expect(activityRepository.deleteByUserAndVendor).toBeCalledTimes(2);
      expect(activityRepository.deleteByUserAndVendor).nthCalledWith(1, 1, 'garmin');
      expect(activityRepository.deleteByUserAndVendor).nthCalledWith(2, 2, 'garmin');
      expect(userRepository.update).toBeCalledTimes(2);
      expect(userRepository.update).nthCalledWith(1, { c2cId: 1 });
      expect(userRepository.update).nthCalledWith(2, { c2cId: 2 });
    });

    it('logs if matching user is not found', async () => {
      jest.spyOn(userRepository, 'findByGarminToken').mockResolvedValueOnce(undefined);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor');
      jest.spyOn(userRepository, 'update');

      const service = new GarminService();
      await service.handleDeauthorizeWebhook([{ userId: 'user1', userAccessToken: 'user1AccessToken' }]);

      expect(userRepository.findByGarminToken).toBeCalledTimes(1);
      expect(userRepository.findByGarminToken).toBeCalledWith('user1AccessToken');
      expect(activityRepository.deleteByUserAndVendor).not.toBeCalled();
      expect(userRepository.update).not.toBeCalled();
    });
  });
});
