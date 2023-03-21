import request from 'supertest';

import { app } from '../../../../src/app';
import log from '../../../../src/helpers/logger';
import type { WebhookEvent } from '../../../../src/server/coros/coros.api';
import { corosService } from '../../../../src/server/coros/coros.service';
import { authenticated } from '../../../utils';

describe('Coros Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    jest.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  describe('GET /coros/exchange-token/:userId', () => {
    it('requires an authenticated user', async () => {
      const response = await request(app.callback()).get('/coros/exchange-token/1').query({ code: 'code' });

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(
        request(app.callback()).get('/coros/exchange-token/1').query({ code: 'longenoughcode' }),
        2,
      );

      expect(response.status).toBe(403);
    });

    it('validates input', async () => {
      const response = await authenticated(
        request(app.callback()).get('/coros/exchange-token/1').query({ code: 'tooshort' }),
        1,
      );

      expect(response.status).toBe(400);
    });

    it('acknowledges authorization denial from user', async () => {
      const response = await authenticated(request(app.callback()).get('/coros/exchange-token/1'), 1);

      expect(response.status).toBe(403);
      expect(response.text).toEqual('auth-denied');
    });

    it('throws if user setup fails', async () => {
      jest.spyOn(corosService, 'requestAccessTokenAndSetupUser').mockRejectedValueOnce(undefined);

      const response = await authenticated(
        request(app.callback()).get('/coros/exchange-token/1').query({ code: 'longenoughcode' }),
        1,
      );

      expect(response.status).toBe(502);
      expect(response.text).toEqual('setup-failed');
    });

    it('setups user', async () => {
      jest.spyOn(corosService, 'requestAccessTokenAndSetupUser').mockResolvedValueOnce(undefined);

      const response = await authenticated(
        request(app.callback()).get('/coros/exchange-token/1').query({ code: 'longenoughcode' }),
        1,
      );

      expect(response.status).toBe(204);
      expect(corosService.requestAccessTokenAndSetupUser).toHaveBeenCalledTimes(1);
      expect(corosService.requestAccessTokenAndSetupUser).toHaveBeenCalledWith(1, 'longenoughcode');
    });
  });

  describe('POST /coros/deauthorize/:userId', () => {
    it('requires an authenticated user', async () => {
      const response = await request(app.callback()).post('/coros/deauthorize/1');

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(request(app.callback()).post('/coros/deauthorize/1'), 2);

      expect(response.status).toBe(403);
    });

    it('retuns 500 if service fails', async () => {
      jest.spyOn(corosService, 'deauthorize').mockRejectedValueOnce(undefined);

      const response = await authenticated(request(app.callback()).post('/coros/deauthorize/1'), 1);

      expect(response.status).toBe(500);
      expect(corosService.deauthorize).toHaveBeenCalledTimes(1);
    });

    it('deauthorizes user', async () => {
      jest.spyOn(corosService, 'deauthorize').mockResolvedValueOnce(undefined);

      const response = await authenticated(request(app.callback()).post('/coros/deauthorize/1'), 1);

      expect(response.status).toBe(204);
      expect(corosService.deauthorize).toHaveBeenCalledTimes(1);
      expect(corosService.deauthorize).toHaveBeenCalledWith(1);
    });
  });

  describe('POST /coros/webhook', () => {
    it('validates input', async () => {
      const response = await request(app.callback()).post('/coros/webhook').send({ what: 'ever' });

      expect(response.status).toBe(400);
    });

    it('handles event', async () => {
      jest.spyOn(corosService, 'handleWebhookEvent').mockResolvedValueOnce(undefined);

      const event: WebhookEvent = {
        sportDataList: [
          {
            openId: '123',
            labelId: '1234',
            mode: 8,
            subMode: 1,
            startTime: 1516096869,
            endTime: 1516097362,
            startTimezone: 32,
            endTimezone: 32,
            fitUrl: 'https://oss.coros.com/fit/407419767966679040/418173292602490880.fit',
          },
        ],
      };
      const response = await request(app.callback())
        .post('/coros/webhook')
        .set('client', 'client')
        .set('secret', 'secret')
        .send(event);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'ok', result: '0000' });
      expect(corosService.handleWebhookEvent).toHaveBeenCalledTimes(1);
      expect(corosService.handleWebhookEvent).toHaveBeenCalledWith(event, 'client', 'secret');
    });
  });
});
