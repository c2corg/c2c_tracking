import request from 'supertest';

import { app } from '../../../../src/app';
import log from '../../../../src/helpers/logger';
import type { WebhookEvent } from '../../../../src/server/decathlon/decathlon.api';
import { decathlonService } from '../../../../src/server/decathlon/decathlon.service';
import { authenticated } from '../../../utils';

describe('Decathlon Controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(log, 'info').mockImplementation(() => Promise.resolve());
    jest.spyOn(log, 'warn').mockImplementation(() => Promise.resolve());
  });

  describe('GET /decathlon/exchange-token/:userId', () => {
    it('requires an authenticated user', async () => {
      const response = await request(app.callback())
        .get('/decathlon/exchange-token/1')
        .query({ code: 'code', scope: '' });

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(
        request(app.callback()).get('/decathlon/exchange-token/1').query({ code: 'longenoughcode', scope: '' }),
        2,
      );

      expect(response.status).toBe(403);
    });

    it('validates input', async () => {
      const response = await authenticated(
        request(app.callback()).get('/decathlon/exchange-token/1').query({ code: 'tooshort', scope: '' }),
        1,
      );

      expect(response.status).toBe(400);
    });

    it('acknowledges authorization denial from user', async () => {
      const response = await authenticated(
        request(app.callback()).get('/decathlon/exchange-token/1').query({ error: 'error', state: '' }),
        1,
      );

      expect(response.status).toBe(403);
      expect(response.text).toEqual('auth-denied');
    });

    it('throws if user setup fails', async () => {
      jest.spyOn(decathlonService, 'requestShortLivedAccessTokenAndSetupUser').mockRejectedValueOnce(undefined);

      const response = await authenticated(
        request(app.callback())
          .get('/decathlon/exchange-token/1')
          .query({ code: 'longenoughcode', state: '', scope: '' }),
        1,
      );

      expect(response.status).toBe(502);
      expect(response.text).toEqual('setup-failed');
    });

    it('setups user', async () => {
      jest.spyOn(decathlonService, 'requestShortLivedAccessTokenAndSetupUser').mockResolvedValueOnce(undefined);

      const response = await authenticated(
        request(app.callback())
          .get('/decathlon/exchange-token/1')
          .query({ code: 'longenoughcode', state: '', scope: '' }),
        1,
      );

      expect(response.status).toBe(204);
      expect(decathlonService.requestShortLivedAccessTokenAndSetupUser).toBeCalledTimes(1);
      expect(decathlonService.requestShortLivedAccessTokenAndSetupUser).toBeCalledWith(1, 'longenoughcode');
    });
  });

  describe('POST /decathlon/deauthorize/:userId', () => {
    it('requires an authenticated user', async () => {
      const response = await request(app.callback()).post('/decathlon/deauthorize/1');

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(request(app.callback()).post('/decathlon/deauthorize/1'), 2);

      expect(response.status).toBe(403);
    });

    it('retuns 500 if service fails', async () => {
      jest.spyOn(decathlonService, 'deauthorize').mockRejectedValueOnce(undefined);

      const response = await authenticated(request(app.callback()).post('/decathlon/deauthorize/1'), 1);

      expect(response.status).toBe(500);
      expect(decathlonService.deauthorize).toBeCalledTimes(1);
    });

    it('deauthorizes user', async () => {
      jest.spyOn(decathlonService, 'deauthorize').mockResolvedValueOnce(undefined);

      const response = await authenticated(request(app.callback()).post('/decathlon/deauthorize/1'), 1);

      expect(response.status).toBe(204);
      expect(decathlonService.deauthorize).toBeCalledTimes(1);
      expect(decathlonService.deauthorize).toBeCalledWith(1);
    });
  });

  describe('POST /decathlon/webhook', () => {
    it('validtes input', async () => {
      const response = await request(app.callback()).post('/decathlon/webhook').query({ what: 'ever' });

      expect(response.status).toBe(400);
    });

    it('handles event', async () => {
      jest.spyOn(decathlonService, 'handleWebhookEvent').mockResolvedValueOnce(undefined);

      const event: WebhookEvent = {
        userId: '1',
        event: {
          name: 'activity_create',
          ressource_id: 'id',
          event_time: 1,
        },
      };
      const response = await request(app.callback()).post('/decathlon/webhook').send(event);

      expect(response.status).toBe(200);
      expect(decathlonService.handleWebhookEvent).toBeCalledTimes(1);
      expect(decathlonService.handleWebhookEvent).toBeCalledWith(event);
    });
  });
});
