import JSONBig from 'json-bigint';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import log from '../../../../src/helpers/logger';
import * as utils from '../../../../src/helpers/utils';
import { miniatureService } from '../../../../src/miniature.service';
import { activityRepository } from '../../../../src/repository/activity.repository';
import { polarRepository } from '../../../../src/repository/polar.repository';
import { userRepository } from '../../../../src/repository/user.repository';
import { polarApi, WebhookEvent } from '../../../../src/server/polar/polar.api';
import { PolarService } from '../../../../src/server/polar/polar.service';
import { userService } from '../../../../src/user.service';

vi.mock('../../../../src/helpers/utils');

describe('Polar Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    vi.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  describe('requestAccessTokenAndSetupUser', () => {
    it('calls API and setups user', async () => {
      vi.spyOn(polarApi, 'exchangeToken').mockResolvedValueOnce({
        access_token: 'access_token',
        x_user_id: 1n,
        token_type: 'bearer',
      });
      vi.spyOn(polarApi, 'registerUser').mockResolvedValueOnce(undefined);
      vi.spyOn(userService, 'configurePolar').mockResolvedValueOnce(undefined);

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
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);

      const service = new PolarService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: User 1 not found]`);
    });

    it('throws if no matching auth exists for user', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });

      const service = new PolarService();
      await expect(service.deauthorize(1)).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Unable to retrieve Polar info for user 1]`,
      );
    });

    it('calls polar API then updates DB', async () => {
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      vi.spyOn(polarApi, 'deleteUser').mockResolvedValueOnce(undefined);
      vi.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce([]);
      vi.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      vi.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));
      vi.spyOn(miniatureService, 'deleteMiniature');

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
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      vi.spyOn(polarApi, 'deleteUser').mockResolvedValueOnce(undefined);
      vi.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockRejectedValueOnce(undefined);
      vi.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      vi.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));
      vi.spyOn(miniatureService, 'deleteMiniature');

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
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      vi.spyOn(polarApi, 'deleteUser').mockResolvedValueOnce(undefined);
      vi.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce(['miniature.png']);
      vi.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      vi.spyOn(miniatureService, 'deleteMiniature').mockImplementationOnce(() => Promise.reject());
      vi.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

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
      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      vi.spyOn(polarApi, 'deleteUser').mockResolvedValueOnce(undefined);
      vi.spyOn(activityRepository, 'getMiniaturesByUserAndVendor').mockResolvedValueOnce(['miniature.png']);
      vi.spyOn(activityRepository, 'deleteByUserAndVendor').mockResolvedValueOnce(undefined);
      vi.spyOn(miniatureService, 'deleteMiniature').mockResolvedValueOnce(undefined);
      vi.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

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
      vi.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      vi.spyOn(polarApi, 'getWebhook').mockResolvedValueOnce({
        data: [
          {
            id: '1',
            url: 'http://localhost:3000/polar/webhook',
            events: ['EXERCISE'],
          },
        ],
      });
      vi.spyOn(polarApi, 'createWebhook');

      const service = new PolarService();
      await service.setupWebhook();

      expect(polarRepository.findWebhookSecret).toHaveBeenCalledTimes(1);
      expect(polarApi.getWebhook).toHaveBeenCalledTimes(1);
      expect(polarApi.createWebhook).not.toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.info).toHaveBeenCalledWith('Found matching Polar webhook subscription');
    });

    it('handles no subscription', async () => {
      vi.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce(undefined);
      vi.spyOn(polarApi, 'getWebhook');
      const requestWebhookSpy = vi
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(PolarService.prototype as any, 'requestWebhookSubscription')
        .mockResolvedValueOnce(undefined);

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
      vi.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      vi.spyOn(polarApi, 'getWebhook').mockRejectedValueOnce(undefined);
      const requestWebhookSpy = vi
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(PolarService.prototype as any, 'requestWebhookSubscription')
        .mockResolvedValueOnce(undefined);

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
      vi.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      vi.spyOn(polarApi, 'getWebhook').mockResolvedValueOnce({
        data: [
          {
            id: '1',
            url: 'not a matching url',
            events: ['EXERCISE'],
          },
        ],
      });
      const requestWebhookSpy = vi
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(PolarService.prototype as any, 'requestWebhookSubscription')
        .mockResolvedValueOnce(undefined);

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
      vi.spyOn(polarApi, 'createWebhook').mockRejectedValueOnce(undefined);
      vi.spyOn(polarRepository, 'setWebhookSecret');

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
      vi.spyOn(polarApi, 'createWebhook').mockResolvedValueOnce('secret');
      vi.spyOn(polarRepository, 'setWebhookSecret').mockRejectedValueOnce(undefined);

      const service = new PolarService();
      await service['requestWebhookSubscription']();

      expect(polarApi.createWebhook).toHaveBeenCalledTimes(1);
      expect(polarRepository.setWebhookSecret).toHaveBeenCalledTimes(1);
      expect(polarRepository.setWebhookSecret).toHaveBeenCalledWith('secret');
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(`Polar webhook secret couldn't be stored in DB`);
    });

    it('creates new subscription', async () => {
      vi.spyOn(polarApi, 'createWebhook').mockResolvedValueOnce('secret');
      vi.spyOn(polarRepository, 'setWebhookSecret').mockResolvedValueOnce(undefined);

      const service = new PolarService();
      await service['requestWebhookSubscription']();

      expect(polarApi.createWebhook).toHaveBeenCalledTimes(1);
      expect(polarRepository.setWebhookSecret).toHaveBeenCalledTimes(1);
      expect(polarRepository.setWebhookSecret).toHaveBeenCalledWith('secret');
    });
  });

  describe('handleWebhookEvent', () => {
    it('does nothing for PING events', async () => {
      vi.spyOn(userRepository, 'findByPolarId');

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

      vi.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce(undefined);

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

      vi.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      vi.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce(undefined);

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

      vi.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      vi.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');

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

      vi.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      vi.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      vi.spyOn(polarApi, 'getExercise').mockRejectedValueOnce('error');

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

      vi.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      vi.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      vi.spyOn(polarApi, 'getExercise').mockResolvedValueOnce({
        id: 'id',
        start_time: '1970-01-01T00:00:01',
        start_time_utc_offset: 180,
        duration: 'PT1S',
        distance: 1,
        sport: 'RUNNING',
      });
      vi.spyOn(polarApi, 'getExerciseFit').mockRejectedValueOnce('error');

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

      vi.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      vi.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      vi.spyOn(polarApi, 'getExercise').mockResolvedValueOnce({
        id: 'id',
        start_time: '1970-01-01T00:00:01',
        start_time_utc_offset: 180,
        duration: 'PT1S',
        distance: 1,
        sport: 'RUNNING',
      });
      vi.spyOn(polarApi, 'getExerciseFit').mockResolvedValueOnce(new ArrayBuffer(1));
      vi.mocked(utils).fitToGeoJSON.mockReturnValueOnce(undefined);

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

      vi.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      vi.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      vi.spyOn(polarApi, 'getExercise').mockResolvedValueOnce({
        id: 'id',
        start_time: '1970-01-01T00:00:01',
        start_time_utc_offset: 180,
        duration: 'PT1S',
        distance: 1,
        sport: 'RUNNING',
      });
      vi.spyOn(polarApi, 'getExerciseFit').mockResolvedValueOnce(new ArrayBuffer(1));
      vi.mocked(utils).fitToGeoJSON.mockReturnValueOnce({
        type: 'LineString',
        coordinates: [[0.0, 0.0, 220]],
      });
      vi.spyOn(userService, 'addActivities').mockRejectedValueOnce('error');

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

      vi.spyOn(userRepository, 'findByPolarId').mockResolvedValueOnce({ c2cId: 1, polar: { id: 1n, token: 'token' } });
      vi.spyOn(polarRepository, 'findWebhookSecret').mockResolvedValueOnce('secret');
      vi.spyOn(polarApi, 'getExercise').mockResolvedValueOnce({
        id: 'id',
        start_time: '1970-01-01T00:00:01',
        start_time_utc_offset: 165,
        duration: 'PT1S',
        distance: 1,
        sport: 'RUNNING',
      });
      vi.spyOn(polarApi, 'getExerciseFit').mockResolvedValueOnce(new ArrayBuffer(1));
      vi.mocked(utils).fitToGeoJSON.mockReturnValueOnce({
        type: 'LineString',
        coordinates: [[0.0, 0.0, 220]],
      });
      vi.spyOn(userService, 'addActivities').mockResolvedValueOnce(undefined);

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
