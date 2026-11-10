import type { Server } from 'http';

import supertest from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../../../../src/app.ts';
import { HttpError } from '../../../../src/helpers/http.ts';
import log from '../../../../src/helpers/logger.ts';
import type { GarminActivity } from '../../../../src/server/garmin/garmin.api.ts';
import { controller as garminController } from '../../../../src/server/garmin/garmin.controller.ts';
import { garminService } from '../../../../src/server/garmin/garmin.service.ts';
import { authenticated } from '../../../utils.ts';

describe('Garmin Controller', () => {
  let server: Server;
  let request: TestAgent;

  beforeAll(() => {
    server = app.listen();
    request = supertest(server);
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await garminController['keyv'].clear();
    vi.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    vi.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  describe('GET /garmin/request-token/:userId', () => {
    it('requires an authenticated user', async () => {
      const response = await request.get('/garmin/request-token/1');

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(request.get('/garmin/request-token/1'), 2);

      expect(response.status).toBe(403);
    });

    it('stores the PKCE verifier and state in memory with 1 hour TTL and returns the authorization URL', async () => {
      vi.spyOn(garminService, 'startAuthorization').mockReturnValueOnce({
        url: 'https://garmin/consent',
        state: 'a-state-123456',
        codeVerifier: 'a-verifier',
      });

      const response = await authenticated(request.get('/garmin/request-token/1'), 1);

      expect(await garminController['keyv'].get('garmin-pkce-1')).toEqual({
        state: 'a-state-123456',
        codeVerifier: 'a-verifier',
      });
      expect(response.body).toEqual({ url: 'https://garmin/consent' });
    });

    it('fails if the PKCE verifier cannot be stored', async () => {
      vi.spyOn(garminService, 'startAuthorization').mockReturnValueOnce({
        url: 'https://garmin/consent',
        state: 'a-state-123456',
        codeVerifier: 'a-verifier',
      });
      vi.spyOn(garminController['keyv'], 'set').mockResolvedValueOnce(false);

      const response = await authenticated(request.get('/garmin/request-token/1'), 1);

      expect(response.status).toBe(502);
      expect(response.text).toBe('setup-failed');
    });

    it('logs the errors of the store instead of crashing', () => {
      const warn = vi.spyOn(log, 'warn').mockImplementation(() => undefined);

      expect(() => garminController['keyv'].emit('error', new Error('connection lost'))).not.toThrow();
      expect(warn).toHaveBeenCalledWith(
        { err: new Error('connection lost') },
        'Garmin pending authorization store error',
      );
    });
  });

  describe('GET /garmin/exchange-token/:userId', () => {
    it('requires valid input', async () => {
      const response = await request.get('/garmin/exchange-token/1').query({ code: 'code', state: 'short' });
      expect(response.status).toBe(400);
    });

    it('acknowledges authorization denial from user', async () => {
      const response = await request.get('/garmin/exchange-token/1').query({ error: 'access_denied' });

      expect(response.status).toBe(403);
      expect(response.text).toEqual('auth-denied');
    });

    it('needs a pending authorization still stored in keyv', async () => {
      const response = await request.get('/garmin/exchange-token/1').query({ code: 'code', state: 'a-state-123456' });

      expect(response.status).toBe(502);
      expect(response.text).toEqual('setup-failed');
    });

    it('rejects a state that does not match the pending authorization', async () => {
      await garminController['keyv'].set('garmin-pkce-1', { state: 'a-state-123456', codeVerifier: 'a-verifier' }, 100);
      vi.spyOn(garminService, 'requestAccessTokenAndSetupUser');

      const response = await request.get('/garmin/exchange-token/1').query({ code: 'code', state: 'another-state-1' });

      expect(response.status).toBe(502);
      expect(response.text).toEqual('setup-failed');
      expect(garminService.requestAccessTokenAndSetupUser).not.toHaveBeenCalled();

      await garminController['keyv'].delete('garmin-pkce-1');
    });

    it('throws if user setup fails', async () => {
      await garminController['keyv'].set('garmin-pkce-1', { state: 'a-state-123456', codeVerifier: 'a-verifier' }, 100);
      vi.spyOn(garminService, 'requestAccessTokenAndSetupUser').mockRejectedValueOnce(undefined);

      const response = await request.get('/garmin/exchange-token/1').query({ code: 'code', state: 'a-state-123456' });

      expect(response.status).toBe(502);
      expect(response.text).toEqual('setup-failed');
    });

    it('setups user and consumes the pending authorization', async () => {
      await garminController['keyv'].set('garmin-pkce-1', { state: 'a-state-123456', codeVerifier: 'a-verifier' }, 100);
      vi.spyOn(garminService, 'requestAccessTokenAndSetupUser').mockResolvedValueOnce(undefined);

      const response = await request.get('/garmin/exchange-token/1').query({ code: 'code', state: 'a-state-123456' });

      expect(response.status).toBe(204);
      expect(garminService.requestAccessTokenAndSetupUser).toHaveBeenCalledTimes(1);
      expect(garminService.requestAccessTokenAndSetupUser).toHaveBeenCalledWith(
        1,
        'code',
        'a-verifier',
        'a-state-123456',
      );
      expect(await garminController['keyv'].get('garmin-pkce-1')).toBeUndefined();
    });
  });

  describe('POST /garmin/deauthorize/:userId', () => {
    it('requires an authenticated user', async () => {
      const response = await request.post('/garmin/deauthorize/1');

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(request.post('/garmin/deauthorize/1'), 2);

      expect(response.status).toBe(403);
    });

    it('throws if garmin API call fails', async () => {
      vi.spyOn(garminService, 'deauthorize').mockRejectedValueOnce(
        new HttpError('failed', { method: 'DELETE', url: 'https://garmin' }, { status: 500 }),
      );

      const response = await authenticated(request.post('/garmin/deauthorize/1'), 1);

      expect(response.status).toBe(500);
    });

    it('throws if garmin API call fails (2)', async () => {
      vi.spyOn(garminService, 'deauthorize').mockRejectedValueOnce(undefined);

      const response = await authenticated(request.post('/garmin/deauthorize/1'), 1);

      expect(response.status).toBe(500);
    });

    it('deauthorizes user with garmin API', async () => {
      vi.spyOn(garminService, 'deauthorize').mockResolvedValueOnce(undefined);

      const response = await authenticated(request.post('/garmin/deauthorize/1'), 1);

      expect(response.status).toBe(204);
      expect(garminService.deauthorize).toHaveBeenCalledTimes(1);
      expect(garminService.deauthorize).toHaveBeenCalledWith(1);
    });
  });

  describe('POST /garmin/webhook/activities', () => {
    it('validates input', async () => {
      vi.spyOn(garminService, 'handleActivityWebhook').mockResolvedValueOnce(undefined);

      const response = await request.post('/garmin/webhook/activities').send({ invalid: 'input' });

      expect(response.status).toBe(400);
    });

    it('handles webhook', async () => {
      vi.spyOn(garminService, 'handleActivityWebhook').mockResolvedValueOnce(undefined);

      const body: {
        activityDetails: (GarminActivity & { userId: string; userAccessToken?: string })[];
      } = {
        activityDetails: [],
      };
      const response = await request.post('/garmin/webhook/activities').send(body);

      expect(response.status).toBe(200);
      expect(garminService.handleActivityWebhook).toHaveBeenCalledTimes(1);
      expect(garminService.handleActivityWebhook).toHaveBeenCalledWith([]);
    });
  });

  describe('POST /garmin/webhook/deauthorize', () => {
    it('validates input', async () => {
      vi.spyOn(garminService, 'handleDeauthorizeWebhook').mockResolvedValueOnce(undefined);

      const response = await request.post('/garmin/webhook/deauthorize').send({ invalid: 'input' });

      expect(response.status).toBe(400);
    });

    it('handles webhook', async () => {
      vi.spyOn(garminService, 'handleDeauthorizeWebhook').mockResolvedValueOnce(undefined);

      const body: { deregistrations: { userId: string; userAccessToken?: string }[] } = {
        deregistrations: [],
      };
      const response = await request.post('/garmin/webhook/deauthorize').send(body);

      expect(response.status).toBe(200);
      expect(garminService.handleDeauthorizeWebhook).toHaveBeenCalledTimes(1);
    });
  });
});
