import JSONBig from 'json-bigint';

import log from '../../../../src/helpers/logger.js';
import * as utils from '../../../../src/helpers/utils.js';
import { miniatureService } from '../../../../src/miniature.service';
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
    jest.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    jest.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  describe('requestAccessTokenAndSetupUser', () => {
    it('calls API and setups user', async () => {
      jest
        .spyOn(polarApi, 'exchangeToken')
        .mockResolvedValueOnce({ access_token: 'access_token', x_user_id: 1n, token_type: 'bearer' });
      jest.spyOn(polarApi, 'registerUser').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(userService, 'configurePolar').mockImplementationOnce(() => Promise.resolve());

      const service = new PolarService();
      await service.requestAccessTokenAndSetupUser(1, 'code');

      expect(polarApi.exchangeToken).toHaveBeenCalledTimes(1);
      expect(polarApi.exchangeToken).toHaveBeenCalledWith('code');
      expect(polarApi.registerUser).toHaveBeenCalledTimes(1);
      expect(polarApi.registerUser).toHaveBeenCalledWith('access_token', 1n);
      expect(userService.configurePolar).toHaveBeenCalledTimes(1);
      expect(userService.configurePolar).toHaveBeenCalledWith(1, {
        access_token: 'access_token',
        x_user_id: 1n,
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
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      jest.spyOn(polarApi, 'deleteUser').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce([]);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));
      jest.spyOn(miniatureService, 'deleteMiniature');

      const service = new PolarService();
      await service.deauthorize(1);
      expect(polarApi.deleteUser).toHaveBeenCalledTimes(1);
      expect(polarApi.deleteUser).toHaveBeenCalledWith('token', 1n);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'polar');
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'polar');
      expect(miniatureService.deleteMiniature).not.toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(userRepository.update).toHaveBeenCalledWith(expect.not.objectContaining({ polar: expect.anything() }));
    });

    it('warns if no miniature info could be retrieved', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      jest.spyOn(polarApi, 'deleteUser').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockRejectedValueOnce(undefined);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));
      jest.spyOn(miniatureService, 'deleteMiniature');

      const service = new PolarService();
      await service.deauthorize(1);
      expect(polarApi.deleteUser).toHaveBeenCalledTimes(1);
      expect(polarApi.deleteUser).toHaveBeenCalledWith('token', 1n);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'polar');
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(`Failed retrieving miniatures info for user 1 and vendor polar`);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'polar');
      expect(miniatureService.deleteMiniature).not.toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(userRepository.update).toHaveBeenCalledWith(expect.not.objectContaining({ polar: expect.anything() }));
    });

    it('warns if miniature could not be deleted', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      jest.spyOn(polarApi, 'deleteUser').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce(['miniature.png']);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(miniatureService, 'deleteMiniature').mockImplementationOnce(() => Promise.reject());
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new PolarService();
      await service.deauthorize(1);
      expect(polarApi.deleteUser).toHaveBeenCalledTimes(1);
      expect(polarApi.deleteUser).toHaveBeenCalledWith('token', 1n);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.getMiniaturesByUserAndVendor).toHaveBeenCalledWith(1, 'polar');
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'polar');
      expect(miniatureService.deleteMiniature).toHaveBeenCalledTimes(1);
      expect(miniatureService.deleteMiniature).toHaveBeenCalledWith('miniature.png');
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(`Failed deleting miniature miniature.png`);
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(userRepository.update).toHaveBeenCalledWith(expect.not.objectContaining({ polar: expect.anything() }));
    });

    it('deletes miniatures', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      jest.spyOn(polarApi, 'deleteUser').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce(['miniature.png']);
      jest.spyOn(activityRepository, 'deleteByUserAndVendor').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(miniatureService, 'deleteMiniature').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new PolarService();
      await service.deauthorize(1);
      expect(polarApi.deleteUser).toHaveBeenCalledTimes(1);
      expect(polarApi.deleteUser).toHaveBeenCalledWith('token', 1n);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledTimes(1);
      expect(activityRepository.deleteByUserAndVendor).toHaveBeenCalledWith(1, 'polar');
      expect(miniatureService.deleteMiniature).toHaveBeenCalledTimes(1);
      expect(miniatureService.deleteMiniature).toHaveBeenCalledWith('miniature.png');
      expect(log.warn).not.toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(userRepository.update).toHaveBeenCalledWith(expect.not.objectContaining({ polar: expect.anything() }));
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

      expect(polarRepository.findWebhookSecret).toHaveBeenCalledTimes(1);
      expect(polarApi.getWebhook).toHaveBeenCalledTimes(1);
      expect(polarApi.createWebhook).not.toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledWith('Found matching Polar webhook subscription');
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

      expect(polarRepository.findWebhookSecret).toHaveBeenCalledTimes(1);
      expect(polarApi.getWebhook).not.toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledWith('No Polar webhook subscription found in DB');
      expect(requestWebhookSpy).toHaveBeenCalledTimes(1);

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

      expect(polarRepository.findWebhookSecret).toHaveBeenCalledTimes(1);
      expect(polarApi.getWebhook).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        `Polar webhook subscription status couldn't be checked: unable to retrieve current subscription. Assuming not set`,
      );
      expect(requestWebhookSpy).toHaveBeenCalledTimes(1);

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

      expect(polarRepository.findWebhookSecret).toHaveBeenCalledTimes(1);
      expect(polarApi.getWebhook).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledWith('No matching Polar webhook subscription found');
      expect(requestWebhookSpy).toHaveBeenCalledTimes(1);

      requestWebhookSpy.mockRestore();
    });

    it('logs if subscription cannot be created', async () => {
      jest.spyOn(polarApi, 'createWebhook').mockRejectedValueOnce(undefined);
      jest.spyOn(polarRepository, 'setWebhookSecret');

      const service = new PolarService();
      await service['requestWebhookSubscription']();

      expect(polarApi.createWebhook).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        `Polar subscription couldn't be requested, maybe another webhook is already registered`,
      );
      expect(polarRepository.setWebhookSecret).not.toHaveBeenCalled();
    });

    it('logs if subscription cannot be stored in DB', async () => {
      jest.spyOn(polarApi, 'createWebhook').mockResolvedValueOnce('secret');
      jest.spyOn(polarRepository, 'setWebhookSecret').mockRejectedValueOnce(undefined);

      const service = new PolarService();
      await service['requestWebhookSubscription']();

      expect(polarApi.createWebhook).toHaveBeenCalledTimes(1);
      expect(polarRepository.setWebhookSecret).toHaveBeenCalledTimes(1);
      expect(polarRepository.setWebhookSecret).toHaveBeenCalledWith('secret');
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(`Polar webhook secret couldn't be stored in DB`);
    });

    it('creates new subscription', async () => {
      jest.spyOn(polarApi, 'createWebhook').mockResolvedValueOnce('secret');
      jest.spyOn(polarRepository, 'setWebhookSecret').mockResolvedValueOnce(undefined);

      const service = new PolarService();
      await service['requestWebhookSubscription']();

      expect(polarApi.createWebhook).toHaveBeenCalledTimes(1);
      expect(polarRepository.setWebhookSecret).toHaveBeenCalledTimes(1);
      expect(polarRepository.setWebhookSecret).toHaveBeenCalledWith('secret');
    });
  });

  describe('handleWebhookEvent', () => {
    it('does nothing for PING events', async () => {
      jest.spyOn(userRepository, 'findByPolarId');

      const event: WebhookEvent = { event: 'PING', timestamp: '1970-01-01T00:00:01Z' };
      const raw = JSONBig.stringify(event);
      const signature = 'signature';

      const service = new PolarService();
      await service.handleWebhookEvent(event, raw, signature);

      expect(userRepository.findByPolarId).not.toHaveBeenCalled();
    });

    it('logs if no matching user is found', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1n,
      };
      const raw = JSONBig.stringify(event);
      const signature = 'signature';

      jest.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce(undefined);

      const service = new PolarService();
      await service.handleWebhookEvent(event, raw, signature);

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        `Polar activity creation webhook event for Polar user 1 couldn't be processed: unable to find matching user in DB`,
      );
    });

    it('logs and returns if no secret is stored in db', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1n,
      };
      const raw = JSONBig.stringify(event);
      const signature = 'signature';

      jest
        .spyOn(userRepository, 'findByPolarId')
        .mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      jest.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce(undefined);

      const service = new PolarService();
      await service.handleWebhookEvent(event, raw, signature);

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(`Invalid Polar webhook event: signature doesn't match`);
    });

    it('logs and returns if signature is invalid', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1n,
      };
      const raw = JSONBig.stringify(event);
      const signature = 'signature';

      jest
        .spyOn(userRepository, 'findByPolarId')
        .mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      jest.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');

      const service = new PolarService();
      await service.handleWebhookEvent(event, raw, signature);

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(`Invalid Polar webhook event: signature doesn't match`);
    });

    it('logs and returns if exercise info cannot be retrieved', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1n,
      };
      const raw = JSONBig.stringify(event);
      const signature = 'cc1d12ed8e5a82a564ec4b0e75c2bde2e5541d15dbb736dcf446a644b3609853';

      jest
        .spyOn(userRepository, 'findByPolarId')
        .mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      jest.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      jest.spyOn(polarApi, 'getExercise').mockRejectedValueOnce('error');

      const service = new PolarService();
      await service.handleWebhookEvent(event, raw, signature);

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        `Polar exercise webhook event for user 1 couldn't be processed: unable to retrieve exercise data`,
      );
    });

    it('logs and returns if exercise FIT cannot be retrieved', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1n,
      };
      const raw = JSONBig.stringify(event);
      const signature = 'cc1d12ed8e5a82a564ec4b0e75c2bde2e5541d15dbb736dcf446a644b3609853';

      jest
        .spyOn(userRepository, 'findByPolarId')
        .mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
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

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        `Polar exercise webhook event for user 1 couldn't be processed: unable to retrieve exercise FIT data`,
      );
    });

    it('logs and returns if gemoetry cannot be extracted from FIT', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1n,
      };
      const raw = JSONBig.stringify(event);
      const signature = 'cc1d12ed8e5a82a564ec4b0e75c2bde2e5541d15dbb736dcf446a644b3609853';

      jest
        .spyOn(userRepository, 'findByPolarId')
        .mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
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

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        `Polar exercise webhook event for user 1 couldn't be processed: unable to convert exercise FIT data to geometry`,
      );
    });

    it('logs and returns if activity cannot be saved in DB', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1n,
      };
      const raw = JSONBig.stringify(event);
      const signature = 'cc1d12ed8e5a82a564ec4b0e75c2bde2e5541d15dbb736dcf446a644b3609853';

      jest
        .spyOn(userRepository, 'findByPolarId')
        .mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
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

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        `Polar activity creation webhook event for user 1 couldn't be processed: unable to insert activity data`,
      );
    });

    it('saves activity', async () => {
      const event: WebhookEvent = {
        event: 'EXERCISE',
        timestamp: '1970-01-01T00:00:01Z',
        entity_id: 'entityId',
        user_id: 1n,
      };
      const raw = JSONBig.stringify(event);
      const signature = 'cc1d12ed8e5a82a564ec4b0e75c2bde2e5541d15dbb736dcf446a644b3609853';

      jest
        .spyOn(userRepository, 'findByPolarId')
        .mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
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

      expect(userService.addActivities).toHaveBeenCalledTimes(1);
      expect(userService.addActivities).toHaveBeenCalledWith(1, {
        date: '1970-01-01T00:00:01+02:45',
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
