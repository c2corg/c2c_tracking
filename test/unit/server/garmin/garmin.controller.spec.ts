import { Server } from 'http';

import { AxiosError } from 'axios';
import supertest from 'supertest';
import TestAgent from 'supertest/lib/agent';

import { app } from '../../../../src/app';
import log from '../../../../src/helpers/logger';
import type { GarminActivity } from '../../../../src/server/garmin/garmin.api';
import { controller as garminController } from '../../../../src/server/garmin/garmin.controller';
import { garminService } from '../../../../src/server/garmin/garmin.service';
import { authenticated } from '../../../utils';

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
    jest.clearAllMocks();
    await garminController['keyv'].clear();
    jest.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    jest.spyOn(log, 'warn').mockImplementation(() => {
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

    it('stores retrieved token secret in memory with 1 hour TTL and returns token', async () => {
      jest
        .spyOn(garminService, 'requestUnauthorizedRequestToken')
        .mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });

      const response = await authenticated(request.get('/garmin/request-token/1'), 1);

      expect(await garminController['keyv'].get('1')).toBe('tokenSecret');
      expect(response.body).toEqual({ token: 'token' });
    });
  });

  describe('POST /garmin/exchange-token/:userId', () => {
    it('requires valid input', async () => {
      const response = await request
        .get('/garmin/exchange-token/1')
        .query({ oauth_token: 'short', oauth_verifier: 'watever' });
      expect(response.status).toBe(400);
    });

    it('acknowledges authorization denial from user', async () => {
      const response = await request
        .get('/garmin/exchange-token/1')
        .query({ oauth_token: 'oauth_token', oauth_verifier: 'NULL' });

      expect(response.status).toBe(403);
      expect(response.text).toEqual('auth-denied');
    });

    it('needs a token secret still stored in keyv', async () => {
      const response = await request
        .get('/garmin/exchange-token/1')
        .query({ oauth_token: 'oauth_token', oauth_verifier: 'oauth_verifier' });

      expect(response.status).toBe(502);
      expect(response.text).toEqual('setup-failed');
    });

    it('throws if user setup fails', async () => {
      await garminController['keyv'].set('1', 'tokenSecret', 100);
      jest.spyOn(garminService, 'requestAccessTokenAndSetupUser').mockRejectedValueOnce(undefined);

      const response = await request
        .get('/garmin/exchange-token/1')
        .query({ oauth_token: 'oauth_token', oauth_verifier: 'oauth_verifier' });

      expect(response.status).toBe(502);
      expect(response.text).toEqual('setup-failed');

      // ensure we clear the entry
      await garminController['keyv'].delete('1');
    });

    it('setups user', async () => {
      await garminController['keyv'].set('1', 'tokenSecret', 100);
      jest.spyOn(garminService, 'requestAccessTokenAndSetupUser').mockResolvedValueOnce(undefined);

      const response = await request
        .get('/garmin/exchange-token/1')
        .query({ oauth_token: 'oauth_token', oauth_verifier: 'oauth_verifier' });

      expect(response.status).toBe(204);
      expect(garminService.requestAccessTokenAndSetupUser).toHaveBeenCalledTimes(1);
      expect(garminService.requestAccessTokenAndSetupUser).toHaveBeenCalledWith(
        1,
        'oauth_token',
        'tokenSecret',
        'oauth_verifier',
      );

      // ensure we clear the entry
      await garminController['keyv'].delete('1');
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
      jest.spyOn(garminService, 'deauthorize').mockRejectedValueOnce(new AxiosError());

      const response = await authenticated(request.post('/garmin/deauthorize/1'), 1);

      expect(response.status).toBe(500);
    });

    it('throws if garmin API call fails (2)', async () => {
      jest.spyOn(garminService, 'deauthorize').mockRejectedValueOnce(undefined);

      const response = await authenticated(request.post('/garmin/deauthorize/1'), 1);

      expect(response.status).toBe(500);
    });

    it('deauthorizes user with garmin API', async () => {
      jest.spyOn(garminService, 'deauthorize').mockResolvedValueOnce(undefined);

      const response = await authenticated(request.post('/garmin/deauthorize/1'), 1);

      expect(response.status).toBe(204);
      expect(garminService.deauthorize).toHaveBeenCalledTimes(1);
      expect(garminService.deauthorize).toHaveBeenCalledWith(1);
    });
  });

  describe('POST /garmin/webhook/activities', () => {
    it('validates input', async () => {
      jest.spyOn(garminService, 'handleActivityWebhook').mockResolvedValueOnce(undefined);

      const response = await request.post('/garmin/webhook/activities').send({ invalid: 'input' });

      expect(response.status).toBe(400);
    });

    it('handles webhook', async () => {
      jest.spyOn(garminService, 'handleActivityWebhook').mockResolvedValueOnce(undefined);

      const body: {
        activityDetails: (GarminActivity & { userId: string; userAccessToken: string })[];
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
      jest.spyOn(garminService, 'handleDeauthorizeWebhook').mockResolvedValueOnce(undefined);

      const response = await request.post('/garmin/webhook/deauthorize').send({ invalid: 'input' });

      expect(response.status).toBe(400);
    });

    it('handles webhook', async () => {
      jest.spyOn(garminService, 'handleDeauthorizeWebhook').mockResolvedValueOnce(undefined);

      const body: { deregistrations: { userId: string; userAccessToken: string }[] } = {
        deregistrations: [],
      };
      const response = await request.post('/garmin/webhook/deauthorize').send(body);

      expect(response.status).toBe(200);
      expect(garminService.handleDeauthorizeWebhook).toHaveBeenCalledTimes(1);
    });
  });
});
