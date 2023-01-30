import log from '../../../../src/helpers/logger';
import * as utils from '../../../../src/helpers/utils';
import { activityRepository } from '../../../../src/repository/activity.repository';
import { polarRepository } from '../../../../src/repository/polar.repository';
import { userRepository } from '../../../../src/repository/user.repository';
import { polarApi, WebhookEvent } from '../../../../src/server/polar/polar.api';
import { PolarService } from '../../../../src/server/polar/polar.service';
import { userService } from '../../../../src/user.service';

jest.mock('../../../../src/helpers/utils');

describe('Polar Service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(log, 'info').mockImplementation(() => Promise.resolve());
    jest.spyOn(log, 'warn').mockImplementation(() => Promise.resolve());
  });

  describe('requestAccessTokenAndSetupUser', () => {
    it('calls API and setups user', async () => {
      jest
        .spyOn(polarApi, 'exchangeToken')
        .mockResolvedValueOnce({ access_token: 'access_token', x_user_id: 1, token_type: 'bearer' });
      jest.spyOn(polarApi, 'registerUser').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(userService, 'configurePolar').mockImplementationOnce(() => Promise.resolve());

      const service = new PolarService();
      await service.requestAccessTokenAndSetupUser(1, 'code');

      expect(polarApi.exchangeToken).toBeCalledTimes(1);
      expect(polarApi.exchangeToken).toBeCalledWith('code');
      expect(polarApi.registerUser).toBeCalledTimes(1);
      expect(polarApi.registerUser).toBeCalledWith('access_token', 1);
      expect(userService.configurePolar).toBeCalledTimes(1);
      expect(userService.configurePolar).toBeCalledWith(1, {
        access_token: 'access_token',
        x_user_id: 1,
        token_type: 'bearer',
      });
    });
  });

  describe('deauthorize', () => {
    it('throws if no matching user is found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);

      const service = new PolarService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(`"User 1 not found"`);
    });

    it('throws if no matching auth exists for user', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });

      const service = new PolarService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Unable to retrieve Polar info for user 1"`,
      );
    });

    it('calls polar API then updates DB', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1, token: 'token' } });
      jest.spyOn(polarApi, 'deleteUser').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new PolarService();
      await service.deauthorize(1);
      expect(polarApi.deleteUser).toBeCalledTimes(1);
      expect(polarApi.deleteUser).toBeCalledWith('token', 1);
      expect(activityRepository.deleteByUserAndVendor).toBeCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toBeCalledWith(1, 'polar');
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith(expect.not.objectContaining({ polar: expect.anything() }));
    });
  });

  describe('setupWebhook', () => {
    it('handles existing subscription', async () => {
      jest.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      jest.spyOn(polarApi, 'getWebhook').mockResolvedValueOnce({
        data: [
          {
            id: '1',
            url: 'http://localhost:3000/polar/webhook',
            events: ['EXERCISE'],
          },
        ],
      });
      jest.spyOn(polarApi, 'createWebhook');

      const service = new PolarService();
      await service.setupWebhook();

      expect(polarRepository.findWebhookSecret).toBeCalledTimes(1);
      expect(polarApi.getWebhook).toBeCalledTimes(1);
      expect(polarApi.createWebhook).not.toBeCalled();
      expect(log.info).toBeCalledTimes(1);
      expect(log.info).toBeCalledWith('Found matching Polar webhook subscription');
    });

    it('handles no subscription', async () => {
      jest.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce(undefined);
      jest.spyOn(polarApi, 'getWebhook');
      const requestWebhookSpy = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(PolarService.prototype as any, 'requestWebhookSubscription')
        .mockImplementationOnce(() => Promise.resolve());

      const service = new PolarService();
      await service.setupWebhook();

      expect(polarRepository.findWebhookSecret).toBeCalledTimes(1);
      expect(polarApi.getWebhook).not.toBeCalled();
      expect(log.info).toBeCalledTimes(1);
      expect(log.info).toBeCalledWith('No Polar webhook subscription found in DB');
      expect(requestWebhookSpy).toBeCalledTimes(1);

      requestWebhookSpy.mockRestore();
    });

    it('handles subscription check error', async () => {
      jest.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      jest.spyOn(polarApi, 'getWebhook').mockRejectedValueOnce(undefined);
      const requestWebhookSpy = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(PolarService.prototype as any, 'requestWebhookSubscription')
        .mockImplementationOnce(() => Promise.resolve());

      const service = new PolarService();
      await service.setupWebhook();

      expect(polarRepository.findWebhookSecret).toBeCalledTimes(1);
      expect(polarApi.getWebhook).toBeCalledTimes(1);
      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
        `Polar webhook subscription status couldn't be checked: unable to retrieve current subscription. Assuming not set`,
      );
      expect(requestWebhookSpy).toBeCalledTimes(1);

      requestWebhookSpy.mockRestore();
    });

    it('handles not matching polar subscription', async () => {
      jest.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      jest.spyOn(polarApi, 'getWebhook').mockResolvedValueOnce({
        data: [
          {
            id: '1',
            url: 'not a matching url',
            events: ['EXERCISE'],
          },
        ],
      });
      const requestWebhookSpy = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(PolarService.prototype as any, 'requestWebhookSubscription')
        .mockImplementationOnce(() => Promise.resolve());

      const service = new PolarService();
      await service.setupWebhook();

      expect(polarRepository.findWebhookSecret).toBeCalledTimes(1);
      expect(polarApi.getWebhook).toBeCalledTimes(1);
      expect(log.info).toBeCalledTimes(1);
      expect(log.info).toBeCalledWith('No matching Polar webhook subscription found');
      expect(requestWebhookSpy).toBeCalledTimes(1);

      requestWebhookSpy.mockRestore();
    });

    it('logs if subscription cannot be created', async () => {
      jest.spyOn(polarApi, 'createWebhook').mockRejectedValueOnce(undefined);
      jest.spyOn(polarRepository, 'setWebhookSecret');

      const service = new PolarService();
      await service['requestWebhookSubscription']();

      expect(polarApi.createWebhook).toBeCalledTimes(1);
      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
        `Polar subscription couldn't be requested, maybe another webhook is already registered`,
      );
      expect(polarRepository.setWebhookSecret).not.toBeCalled();
    });

    it('logs if subscription cannot be stored in DB', async () => {
      jest.spyOn(polarApi, 'createWebhook').mockResolvedValueOnce('secret');
      jest.spyOn(polarRepository, 'setWebhookSecret').mockRejectedValueOnce(undefined);

      const service = new PolarService();
      await service['requestWebhookSubscription']();

      expect(polarApi.createWebhook).toBeCalledTimes(1);
      expect(polarRepository.setWebhookSecret).toBeCalledTimes(1);
      expect(polarRepository.setWebhookSecret).toBeCalledWith('secret');
      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(`Polar webhook secret couldn't be stored in DB`);
    });

    it('creates new subscription', async () => {
      jest.spyOn(polarApi, 'createWebhook').mockResolvedValueOnce('secret');
      jest.spyOn(polarRepository, 'setWebhookSecret').mockResolvedValueOnce(undefined);

      const service = new PolarService();
      await service['requestWebhookSubscription']();

      expect(polarApi.createWebhook).toBeCalledTimes(1);
      expect(polarRepository.setWebhookSecret).toBeCalledTimes(1);
      expect(polarRepository.setWebhookSecret).toBeCalledWith('secret');
    });
  });

  describe('handleWebhookEvent', () => {
    it('does nothing for PING events', async () => {
      const event: WebhookEvent = { event: 'PING', timestamp: '1970-01-01T00:00:01Z' };
      const raw = JSON.stringify(event);
      const signature = 'signature';

      const service = new PolarService();
      await service.handleWebhookEvent(event, raw, signature);
    });

    it('logs if no matching user is found', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1,
        url: 'https://www.polaraccesslink.com/v3/exercises/entityId',
      };
      const raw = JSON.stringify(event);
      const signature = 'signature';

      jest.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce(undefined);

      const service = new PolarService();
      await service.handleWebhookEvent(event, raw, signature);

      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
        `Polar activity creation webhook event for Polar user 1 couldn't be processed: unable to find matching user in DB`,
      );
    });

    it('logs and returns if no secret is stored in db', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1,
        url: 'https://www.polaraccesslink.com/v3/exercises/entityId',
      };
      const raw = JSON.stringify(event);
      const signature = 'signature';

      jest.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1, token: 'token' } });
      jest.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce(undefined);

      const service = new PolarService();
      await service.handleWebhookEvent(event, raw, signature);

      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(`Invalid Polar webhook event: signature doesn't match`);
    });

    it('logs and returns if signature is invalid', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1,
        url: 'https://www.polaraccesslink.com/v3/exercises/entityId',
      };
      const raw = JSON.stringify(event);
      const signature = 'signature';

      jest.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1, token: 'token' } });
      jest.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');

      const service = new PolarService();
      await service.handleWebhookEvent(event, raw, signature);

      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(`Invalid Polar webhook event: signature doesn't match`);
    });

    it('logs and returns if matching exercise id cannot be extracted', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1,
        url: 'https://nowhere',
      };
      const raw = JSON.stringify(event);
      const signature = 'c811b6bd84e9fb0212d95f3190d539e510ecb7f6a0cef924785fe2d0d6b93fc2';

      jest.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1, token: 'token' } });
      jest.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');

      const service = new PolarService();
      await service.handleWebhookEvent(event, raw, signature);

      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
        `Polar exercise webhook event for user 1 couldn't be processed: unable to retrieve exercise id`,
      );
    });

    it('logs and returns if exercise info cannot be retrieved', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1,
        url: 'https://www.polaraccesslink.com/v3/exercises/entityId',
      };
      const raw = JSON.stringify(event);
      const signature = 'bd8f35142b8b5a82f35a5a8056af7e65f1f204ff854dcb2e15ab25c5636a97fd';

      jest.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1, token: 'token' } });
      jest.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      jest.spyOn(polarApi, 'getExercise').mockRejectedValueOnce('error');

      const service = new PolarService();
      await service.handleWebhookEvent(event, raw, signature);

      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
        `Polar exercise webhook event for user 1 couldn't be processed: unable to retrieve exercise data`,
      );
    });

    it('logs and returns if exercise FIT cannot be retrieved', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1,
        url: 'https://www.polaraccesslink.com/v3/exercises/entityId',
      };
      const raw = JSON.stringify(event);
      const signature = 'bd8f35142b8b5a82f35a5a8056af7e65f1f204ff854dcb2e15ab25c5636a97fd';

      jest.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1, token: 'token' } });
      jest.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      jest.spyOn(polarApi, 'getExercise').mockResolvedValueOnce({
        id: 'id',
        start_time: '1970-01-01T00:00:01',
        start_time_utc_offset: 180,
        duration: 'PT1S',
        distance: 1,
        sport: 'RUNNING',
      });
      jest.spyOn(polarApi, 'getExerciseFit').mockRejectedValueOnce('error');

      const service = new PolarService();
      await service.handleWebhookEvent(event, raw, signature);

      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
        `Polar exercise webhook event for user 1 couldn't be processed: unable to retrieve exercise FIT data`,
      );
    });

    it('logs and returns if gemoetry cannot be extracted from FIT', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1,
        url: 'https://www.polaraccesslink.com/v3/exercises/entityId',
      };
      const raw = JSON.stringify(event);
      const signature = 'bd8f35142b8b5a82f35a5a8056af7e65f1f204ff854dcb2e15ab25c5636a97fd';

      jest.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1, token: 'token' } });
      jest.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      jest.spyOn(polarApi, 'getExercise').mockResolvedValueOnce({
        id: 'id',
        start_time: '1970-01-01T00:00:01',
        start_time_utc_offset: 180,
        duration: 'PT1S',
        distance: 1,
        sport: 'RUNNING',
      });
      jest.spyOn(polarApi, 'getExerciseFit').mockResolvedValueOnce(new ArrayBuffer(1));
      jest.mocked(utils).fitToGeoJSON.mockReturnValueOnce(undefined);

      const service = new PolarService();
      await service.handleWebhookEvent(event, raw, signature);

      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
        `Polar exercise webhook event for user 1 couldn't be processed: unable to convert exercise FIT data to geometry`,
      );
    });

    it('logs and returns if activity cannot be saved in DB', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1,
        url: 'https://www.polaraccesslink.com/v3/exercises/entityId',
      };
      const raw = JSON.stringify(event);
      const signature = 'bd8f35142b8b5a82f35a5a8056af7e65f1f204ff854dcb2e15ab25c5636a97fd';

      jest.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1, token: 'token' } });
      jest.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      jest.spyOn(polarApi, 'getExercise').mockResolvedValueOnce({
        id: 'id',
        start_time: '1970-01-01T00:00:01',
        start_time_utc_offset: 180,
        duration: 'PT1S',
        distance: 1,
        sport: 'RUNNING',
      });
      jest.spyOn(polarApi, 'getExerciseFit').mockResolvedValueOnce(new ArrayBuffer(1));
      jest.mocked(utils).fitToGeoJSON.mockReturnValueOnce({
        type: 'LineString',
        coordinates: [[0.0, 0.0, 220]],
      });
      jest.spyOn(userService, 'addActivities').mockRejectedValueOnce('error');

      const service = new PolarService();
      await service.handleWebhookEvent(event, raw, signature);

      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(
        `Polar activity creation webhook event for user 1 couldn't be processed: unable to insert activity data`,
      );
    });

    it('saves activity', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1,
        url: 'https://www.polaraccesslink.com/v3/exercises/entityId',
      };
      const raw = JSON.stringify(event);
      const signature = 'bd8f35142b8b5a82f35a5a8056af7e65f1f204ff854dcb2e15ab25c5636a97fd';

      jest.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1, token: 'token' } });
      jest.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      jest.spyOn(polarApi, 'getExercise').mockResolvedValueOnce({
        id: 'id',
        start_time: '1970-01-01T00:00:01',
        start_time_utc_offset: 165,
        duration: 'PT1S',
        distance: 1,
        sport: 'RUNNING',
      });
      jest.spyOn(polarApi, 'getExerciseFit').mockResolvedValueOnce(new ArrayBuffer(1));
      jest.mocked(utils).fitToGeoJSON.mockReturnValueOnce({
        type: 'LineString',
        coordinates: [[0.0, 0.0, 220]],
      });
      jest.spyOn(userService, 'addActivities').mockImplementationOnce(() => Promise.resolve());

      const service = new PolarService();
      await service.handleWebhookEvent(event, raw, signature);

      expect(userService.addActivities).toBeCalledTimes(1);
      expect(userService.addActivities).toBeCalledWith(1, {
        date: '1970-01-01T00:00:01Z+02:45',
        duration: 1,
        geojson: {
          coordinates: [[0, 0, 220]],
          type: 'LineString',
        },
        length: 1,
        type: 'RUNNING',
        vendor: 'polar',
        vendorId: 'id',
      });
    });
  });
});
