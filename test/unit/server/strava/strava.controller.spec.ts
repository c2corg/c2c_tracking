import { Server } from 'http';

import supertest from 'supertest';
import TestAgent from 'supertest/lib/agent';

import { app } from '../../../../src/app';
import log from '../../../../src/helpers/logger';
import type { WebhookEvent } from '../../../../src/server/strava/strava.api';
import { stravaService } from '../../../../src/server/strava/strava.service';
import { authenticated } from '../../../utils';

describe('Strava Controller', () => {
  let server: Server;
  let request: TestAgent;

  beforeAll(() => {
    server = app.listen();
    request = supertest(server);
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    jest.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  describe('GET /strava/exchange-token/:userId', () => {
    it('requires an authenticated user', async () => {
      const response = await request.get('/strava/exchange-token/1').query({ code: 'code', scope: 'activity:read' });

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(
        request.get('/strava/exchange-token/1').query({ code: 'longenoughcode', scope: 'activity:read' }),
        2,
      );

      expect(response.status).toBe(403);
    });

    it('validates input', async () => {
      const response = await authenticated(
        request.get('/strava/exchange-token/1').query({ code: 'tooshort', scope: 'activity:read' }),
        1,
      );

      expect(response.status).toBe(400);
    });

    it('acknowledges authorization denial from user', async () => {
      const response = await authenticated(request.get('/strava/exchange-token/1').query({ error: 'error' }), 1);

      expect(response.status).toBe(403);
      expect(response.text).toEqual('auth-denied');
    });

    it('throws if unsufficient scopes are accepted', async () => {
      const response = await authenticated(
        request.get('/strava/exchange-token/1').query({ code: 'longenoughcode', scope: 'toto' }),
        1,
      );

      expect(response.status).toBe(403);
      expect(response.text).toEqual('unsufficient-scopes');
    });

    it('throws if user setup fails', async () => {
      jest.spyOn(stravaService, 'requestShortLivedAccessTokenAndSetupUser').mockRejectedValueOnce(undefined);

      const response = await authenticated(
        request.get('/strava/exchange-token/1').query({ code: 'longenoughcode', scope: 'activity:read' }),
        1,
      );

      expect(response.status).toBe(502);
      expect(response.text).toEqual('setup-failed');
    });

    it('setups user', async () => {
      jest.spyOn(stravaService, 'requestShortLivedAccessTokenAndSetupUser').mockResolvedValueOnce(undefined);

      const response = await authenticated(
        request.get('/strava/exchange-token/1').query({ code: 'longenoughcode', scope: 'activity:read' }),
        1,
      );

      expect(response.status).toBe(204);
      expect(stravaService.requestShortLivedAccessTokenAndSetupUser).toHaveBeenCalledTimes(1);
      expect(stravaService.requestShortLivedAccessTokenAndSetupUser).toHaveBeenCalledWith(1, 'longenoughcode');
    });
  });

  describe('POST /strava/deauthorize/:userId', () => {
    it('requires an authenticated user', async () => {
      const response = await request.post('/strava/deauthorize/1');

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(request.post('/strava/deauthorize/1'), 2);

      expect(response.status).toBe(403);
    });

    it('retuns 500 if service fails', async () => {
      jest.spyOn(stravaService, 'deauthorize').mockRejectedValueOnce(undefined);

      const response = await authenticated(request.post('/strava/deauthorize/1'), 1);

      expect(response.status).toBe(500);
      expect(stravaService.deauthorize).toHaveBeenCalledTimes(1);
    });

    it('deauthorizes user', async () => {
      jest.spyOn(stravaService, 'deauthorize').mockResolvedValueOnce(undefined);

      const response = await authenticated(request.post('/strava/deauthorize/1'), 1);

      expect(response.status).toBe(204);
      expect(stravaService.deauthorize).toHaveBeenCalledTimes(1);
      expect(stravaService.deauthorize).toHaveBeenCalledWith(1);
    });
  });

  describe('GET /strava/webhook', () => {
    it('validates input', async () => {
      const response = await request.get('/strava/webhook').query({ what: 'ever' });

      expect(response.status).toBe(400);
    });

    it('validates token', async () => {
      const response = await request
        .get('/strava/webhook')
        .query({ 'hub.mode': 'subscribe', 'hub.challenge': 'challenge', 'hub.verify_token': 'invalid_token' });

      expect(response.status).toBe(502);
    });

    it('replies with challenge', async () => {
      const response = await request
        .get('/strava/webhook')
        .query({ 'hub.mode': 'subscribe', 'hub.challenge': 'challenge', 'hub.verify_token': '%trongpAssM0rd' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ 'hub.challenge': 'challenge' });
    });
  });

  describe('POST /strava/webhook', () => {
    it('validates input', async () => {
      const response = await request.post('/strava/webhook').query({ what: 'ever' });

      expect(response.status).toBe(400);
    });

    it('handles event', async () => {
      jest.spyOn(stravaService, 'handleWebhookEvent').mockResolvedValueOnce(undefined);

      const event: WebhookEvent = {
        object_type: 'activity',
        object_id: 1,
        aspect_type: 'create',
        updates: { title: 'title', private: 'true' },
        owner_id: 1,
        subscription_id: 1,
        event_time: 1,
      };
      const response = await request.post('/strava/webhook').send(event);

      expect(response.status).toBe(200);
      expect(stravaService.handleWebhookEvent).toHaveBeenCalledTimes(1);
      expect(stravaService.handleWebhookEvent).toHaveBeenCalledWith(event);
    });
  });
});
