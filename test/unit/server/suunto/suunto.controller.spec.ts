import request from 'supertest';

import { app } from '../../../../src/app.js';
import log from '../../../../src/helpers/logger.js';
import { suuntoService } from '../../../../src/server/suunto/suunto.service';
import { authenticated } from '../../../utils.js';

describe('Suunto Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    jest.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  describe('GET /suunto/exchange-token/:userId', () => {
    it('requires an authenticated user', async () => {
      const response = await request(app.callback()).get('/suunto/exchange-token/1').query({ code: 'code' });

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(
        request(app.callback()).get('/suunto/exchange-token/1').query({ code: 'longenoughcode' }),
        2,
      );

      expect(response.status).toBe(403);
    });

    it('validates input', async () => {
      const response = await authenticated(
        request(app.callback()).get('/suunto/exchange-token/1').query({ code: 'shrt' }),
        1,
      );

      expect(response.status).toBe(400);
    });

    it('acknowledges authorization denial from user', async () => {
      const response = await authenticated(
        request(app.callback())
          .get('/suunto/exchange-token/1')
          .query({ error: 'error', error_description: 'description' }),
        1,
      );

      expect(response.status).toBe(403);
      expect(response.text).toEqual('auth-denied');
    });

    it('throws if user setup fails', async () => {
      jest.spyOn(suuntoService, 'requestShortLivedAccessTokenAndSetupUser').mockRejectedValueOnce(undefined);

      const response = await authenticated(
        request(app.callback()).get('/suunto/exchange-token/1').query({ code: 'longenoughcode' }),
        1,
      );

      expect(response.status).toBe(502);
      expect(response.text).toEqual('setup-failed');
    });

    it('setups user', async () => {
      jest.spyOn(suuntoService, 'requestShortLivedAccessTokenAndSetupUser').mockResolvedValueOnce(undefined);

      const response = await authenticated(
        request(app.callback()).get('/suunto/exchange-token/1').query({ code: 'longenoughcode' }),
        1,
      );

      expect(response.status).toBe(204);
      expect(suuntoService.requestShortLivedAccessTokenAndSetupUser).toHaveBeenCalledTimes(1);
      expect(suuntoService.requestShortLivedAccessTokenAndSetupUser).toHaveBeenCalledWith(1, 'longenoughcode');
    });
  });

  describe('POST /suunto/webhook', () => {
    it('validates input', async () => {
      jest.spyOn(suuntoService, 'handleWebhookEvent');

      const response = await request(app.callback()).post('/suunto/webhook').send({});

      expect(response.status).toBe(400);
      expect(suuntoService.handleWebhookEvent).not.toHaveBeenCalled();
    });

    it('handle event', async () => {
      jest.spyOn(suuntoService, 'handleWebhookEvent').mockImplementationOnce(() => Promise.resolve());

      await request(app.callback())
        .post('/suunto/webhook')
        .send({ username: 'user', workoutid: 'id' })
        .set({ authorization: 'auth' });

      expect(suuntoService.handleWebhookEvent).toHaveBeenCalledTimes(1);
      expect(suuntoService.handleWebhookEvent).toHaveBeenCalledWith({ username: 'user', workoutid: 'id' }, 'auth');
    });
  });

  describe('POST /suunto/deauthorize/:userId', () => {
    it('requires an authenticated user', async () => {
      const response = await request(app.callback()).post('/suunto/deauthorize/1');

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(request(app.callback()).post('/suunto/deauthorize/1'), 2);

      expect(response.status).toBe(403);
    });

    it('throws if service failed', async () => {
      jest.spyOn(suuntoService, 'deauthorize').mockRejectedValueOnce(undefined);

      const response = await authenticated(request(app.callback()).post('/suunto/deauthorize/1'), 1);

      expect(response.status).toBe(500);
    });

    it('call service', async () => {
      jest.spyOn(suuntoService, 'deauthorize').mockResolvedValueOnce(undefined);

      const response = await authenticated(request(app.callback()).post('/suunto/deauthorize/1'), 1);

      expect(response.status).toBe(204);
    });
  });
});
