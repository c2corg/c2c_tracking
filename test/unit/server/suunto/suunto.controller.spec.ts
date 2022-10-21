import request from 'supertest';

import { app } from '../../../../src/app';
import log from '../../../../src/helpers/logger';
import { suuntoService } from '../../../../src/server/suunto/suunto.service';
import { authenticated } from '../../../utils';

describe('Suunto Controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(log, 'info').mockImplementation(() => Promise.resolve());
    jest.spyOn(log, 'warn').mockImplementation(() => Promise.resolve());
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

      expect(response.redirect).toBeTruthy();
      expect(response.headers['location']).toMatchInlineSnapshot(
        `"http://localhost:8080/external-services?error=auth-denied"`,
      );
    });

    it('redirects if user setup fails', async () => {
      jest.spyOn(suuntoService, 'requestShortLivedAccessTokenAndSetupUser').mockRejectedValueOnce(undefined);

      const response = await authenticated(
        request(app.callback()).get('/suunto/exchange-token/1').query({ code: 'longenoughcode' }),
        1,
      );

      expect(response.redirect).toBeTruthy();
      expect(response.headers['location']).toMatchInlineSnapshot(
        `"http://localhost:8080/external-services?error=setup-failed"`,
      );
    });

    it('setups user and redirects', async () => {
      jest.spyOn(suuntoService, 'requestShortLivedAccessTokenAndSetupUser').mockResolvedValueOnce(undefined);

      const response = await authenticated(
        request(app.callback()).get('/suunto/exchange-token/1').query({ code: 'longenoughcode' }),
        1,
      );

      expect(response.redirect).toBeTruthy();
      expect(response.headers['location']).toEqual(suuntoService.subscriptionUrl);
      expect(suuntoService.requestShortLivedAccessTokenAndSetupUser).toBeCalledTimes(1);
      expect(suuntoService.requestShortLivedAccessTokenAndSetupUser).toBeCalledWith(1, 'longenoughcode');
    });
  });

  describe('POST /suunto/webhook', () => {
    it('validates input', async () => {
      jest.spyOn(suuntoService, 'handleWebhookEvent');

      const response = await request(app.callback()).post('/suunto/webhook').send({});

      expect(response.status).toBe(400);
      expect(suuntoService.handleWebhookEvent).not.toBeCalled();
    });

    it('handle event', async () => {
      jest.spyOn(suuntoService, 'handleWebhookEvent').mockImplementationOnce(() => Promise.resolve());

      await request(app.callback())
        .post('/suunto/webhook')
        .send({ username: 'user', workoutid: 'id' })
        .set({ authorization: 'auth' });

      expect(suuntoService.handleWebhookEvent).toBeCalledTimes(1);
      expect(suuntoService.handleWebhookEvent).toBeCalledWith({ username: 'user', workoutid: 'id' }, 'auth');
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
