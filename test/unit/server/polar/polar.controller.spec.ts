import request from 'supertest';

import { app } from '../../../../src/app';
import log from '../../../../src/helpers/logger';
import type { WebhookEvent } from '../../../../src/server/polar/polar.api';
import { polarService } from '../../../../src/server/polar/polar.service';
import { authenticated } from '../../../utils';

describe('Polar Controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(log, 'info').mockImplementation(() => Promise.resolve());
    jest.spyOn(log, 'warn').mockImplementation(() => Promise.resolve());
  });

  describe('GET /polar/exchange-token/:userId', () => {
    it('requires an authenticated user', async () => {
      const response = await request(app.callback()).get('/polar/exchange-token/1').query({ code: 'code' });

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(
        request(app.callback()).get('/polar/exchange-token/1').query({ code: 'longenoughcode' }),
        2,
      );

      expect(response.status).toBe(403);
    });

    it('validates input', async () => {
      const response = await authenticated(
        request(app.callback()).get('/polar/exchange-token/1').query({ code: 'tooshort' }),
        1,
      );

      expect(response.status).toBe(400);
    });

    it('acknowledges authorization denial from user', async () => {
      const response = await authenticated(
        request(app.callback()).get('/polar/exchange-token/1').query({ error: 'access_denied' }),
        1,
      );

      expect(response.status).toBe(403);
      expect(response.text).toEqual('auth-denied');
    });

    it('throws if user setup fails', async () => {
      jest.spyOn(polarService, 'requestAccessTokenAndSetupUser').mockRejectedValueOnce(undefined);

      const response = await authenticated(
        request(app.callback())
          .get('/polar/exchange-token/1')
          .query({ code: 'longenoughcode', scope: 'activity:read' }),
        1,
      );

      expect(response.status).toBe(502);
      expect(response.text).toEqual('setup-failed');
    });

    it('setups user', async () => {
      jest.spyOn(polarService, 'requestAccessTokenAndSetupUser').mockResolvedValueOnce(undefined);

      const response = await authenticated(
        request(app.callback()).get('/polar/exchange-token/1').query({ code: 'longenoughcode' }),
        1,
      );

      expect(response.status).toBe(204);
      expect(polarService.requestAccessTokenAndSetupUser).toBeCalledTimes(1);
      expect(polarService.requestAccessTokenAndSetupUser).toBeCalledWith(1, 'longenoughcode');
    });
  });

  describe('POST /polar/deauthorize/:userId', () => {
    it('requires an authenticated user', async () => {
      const response = await request(app.callback()).post('/polar/deauthorize/1');

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(request(app.callback()).post('/polar/deauthorize/1'), 2);

      expect(response.status).toBe(403);
    });

    it('retuns 500 if service fails', async () => {
      jest.spyOn(polarService, 'deauthorize').mockRejectedValueOnce(undefined);

      const response = await authenticated(request(app.callback()).post('/polar/deauthorize/1'), 1);

      expect(response.status).toBe(500);
      expect(polarService.deauthorize).toBeCalledTimes(1);
    });

    it('deauthorizes user', async () => {
      jest.spyOn(polarService, 'deauthorize').mockResolvedValueOnce(undefined);

      const response = await authenticated(request(app.callback()).post('/polar/deauthorize/1'), 1);

      expect(response.status).toBe(204);
      expect(polarService.deauthorize).toBeCalledTimes(1);
      expect(polarService.deauthorize).toBeCalledWith(1);
    });
  });

  describe('POST /polar/webhook', () => {
    it('validates input', async () => {
      const response = await request(app.callback()).post('/polar/webhook').query({ what: 'ever' });

      expect(response.status).toBe(400);
    });

    it('handles event', async () => {
      jest.spyOn(polarService, 'handleWebhookEvent').mockResolvedValueOnce(undefined);

      const event: WebhookEvent = {
        event: 'PING',
        timestamp: '1970-01-01T00:00:01',
      };
      const response = await request(app.callback())
        .post('/polar/webhook')
        .set('Polar-Webhook-Signature', 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8')
        .send(event);

      expect(response.status).toBe(200);
      expect(polarService.handleWebhookEvent).toBeCalledTimes(1);
      expect(polarService.handleWebhookEvent).toBeCalledWith(
        event,
        expect.any(String),
        'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
      );
    });
  });
});