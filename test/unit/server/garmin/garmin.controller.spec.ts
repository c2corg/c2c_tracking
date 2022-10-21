import { AxiosError } from 'axios';
import type Keyv from 'keyv';
import request from 'supertest';

import { app } from '../../../../src/app';
import log from '../../../../src/helpers/logger';
import type { GarminActivity } from '../../../../src/server/garmin/garmin.api';
import { controller as garminController } from '../../../../src/server/garmin/garmin.controller';
import { garminService } from '../../../../src/server/garmin/garmin.service';
import { authenticated } from '../../../utils';

describe('Garmin Controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await (garminController['keyv'] as Keyv).clear();
    jest.spyOn(log, 'info').mockImplementation(() => Promise.resolve());
    jest.spyOn(log, 'warn').mockImplementation(() => Promise.resolve());
  });

  describe('GET /garmin/request-token/:useId', () => {
    it('requires an authenticated user', async () => {
      const response = await request(app.callback()).get('/garmin/request-token/1');

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(request(app.callback()).get('/garmin/request-token/1'), 2);

      expect(response.status).toBe(403);
    });

    it('stores retrieved token secret in memory with 1 hour TTL and redirects', async () => {
      jest
        .spyOn(garminService, 'requestUnauthorizedRequestToken')
        .mockResolvedValueOnce({ token: 'token', tokenSecret: 'tokenSecret' });

      const response = await authenticated(request(app.callback()).get('/garmin/request-token/1'), 1);

      expect(await (garminController['keyv'] as Keyv).get('1')).toBe('tokenSecret');
      expect(response.redirect).toBeTruthy();
      expect(response.headers['location']).toMatchInlineSnapshot(
        `"https://connect.garmin.com/oauthConfirm?oauth_token=token&oauth_callback=http://localhost:3000/garmin/exchange-token/1"`,
      );
    });
  });

  describe('POST /garmin/exchange-token/:userId', () => {
    it('requires valid input', async () => {
      const response = await request(app.callback())
        .get('/garmin/exchange-token/1')
        .query({ oauth_token: 'short', oauth_verifier: 'watever' });
      expect(response.status).toBe(400);
    });

    it('acknowledges authorization denial from user', async () => {
      const response = await request(app.callback())
        .get('/garmin/exchange-token/1')
        .query({ oauth_token: 'oauth_token', oauth_verifier: 'NULL' });

      expect(response.redirect).toBeTruthy();
      expect(response.headers['location']).toMatchInlineSnapshot(
        `"http://localhost:8080/external-services?error=auth-denied"`,
      );
    });

    it('needs a token secret still stored in keyv', async () => {
      const response = await request(app.callback())
        .get('/garmin/exchange-token/1')
        .query({ oauth_token: 'oauth_token', oauth_verifier: 'oauth_verifier' });

      expect(response.redirect).toBeTruthy();
      expect(response.headers['location']).toMatchInlineSnapshot(
        `"http://localhost:8080/external-services?error=setup-failed"`,
      );
    });

    it('redirects if user setup fails', async () => {
      await (garminController['keyv'] as Keyv).set('1', 'tokenSecret', 100);
      jest.spyOn(garminService, 'requestAccessTokenAndSetupUser').mockRejectedValueOnce(undefined);

      const response = await request(app.callback())
        .get('/garmin/exchange-token/1')
        .query({ oauth_token: 'oauth_token', oauth_verifier: 'oauth_verifier' });

      expect(response.redirect).toBeTruthy();
      expect(response.headers['location']).toMatchInlineSnapshot(
        `"http://localhost:8080/external-services?error=setup-failed"`,
      );

      // ensure we clear the entry
      await (garminController['keyv'] as Keyv).delete('1');
    });

    it('setups user and redirects', async () => {
      await (garminController['keyv'] as Keyv).set('1', 'tokenSecret', 100);
      jest.spyOn(garminService, 'requestAccessTokenAndSetupUser').mockResolvedValueOnce(undefined);

      const response = await request(app.callback())
        .get('/garmin/exchange-token/1')
        .query({ oauth_token: 'oauth_token', oauth_verifier: 'oauth_verifier' });

      expect(response.redirect).toBeTruthy();
      expect(response.headers['location']).toEqual(garminService.subscriptionUrl);
      expect(garminService.requestAccessTokenAndSetupUser).toBeCalledTimes(1);
      expect(garminService.requestAccessTokenAndSetupUser).toBeCalledWith(
        1,
        'oauth_token',
        'tokenSecret',
        'oauth_verifier',
      );

      // ensure we clear the entry
      await (garminController['keyv'] as Keyv).delete('1');
    });
  });

  describe('POST /garmin/deauthorize/:userId', () => {
    it('requires an authenticated user', async () => {
      const response = await request(app.callback()).post('/garmin/deauthorize/1');

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(request(app.callback()).post('/garmin/deauthorize/1'), 2);

      expect(response.status).toBe(403);
    });

    it('throws if garmin API call fails', async () => {
      jest.spyOn(garminService, 'deauthorize').mockRejectedValueOnce(new AxiosError());

      const response = await authenticated(request(app.callback()).post('/garmin/deauthorize/1'), 1);

      expect(response.status).toBe(500);
    });

    it('throws if garmin API call fails (2)', async () => {
      jest.spyOn(garminService, 'deauthorize').mockRejectedValueOnce(undefined);

      const response = await authenticated(request(app.callback()).post('/garmin/deauthorize/1'), 1);

      expect(response.status).toBe(500);
    });

    it('deauthorizes user with garmin API', async () => {
      jest.spyOn(garminService, 'deauthorize').mockResolvedValueOnce(undefined);

      const response = await authenticated(request(app.callback()).post('/garmin/deauthorize/1'), 1);

      expect(response.status).toBe(204);
      expect(garminService.deauthorize).toBeCalledTimes(1);
      expect(garminService.deauthorize).toBeCalledWith(1);
    });
  });

  describe('POST /garmin/webhook/activities', () => {
    it('validates input', async () => {
      jest.spyOn(garminService, 'handleActivityWebhook').mockResolvedValueOnce(undefined);

      const response = await request(app.callback()).post('/garmin/webhook/activities').send({ invalid: 'input' });

      expect(response.status).toBe(400);
    });

    it('handles webhook', async () => {
      jest.spyOn(garminService, 'handleActivityWebhook').mockResolvedValueOnce(undefined);

      const body: {
        activityDetails: (GarminActivity & { userId: string; userAccessToken: string })[];
      } = {
        activityDetails: [],
      };
      const response = await request(app.callback()).post('/garmin/webhook/activities').send(body);

      expect(response.status).toBe(200);
      expect(garminService.handleActivityWebhook).toBeCalledTimes(1);
      expect(garminService.handleActivityWebhook).toBeCalledWith([]);
    });
  });

  describe('POST /garmin/webhook/deauthorize', () => {
    it('validates input', async () => {
      jest.spyOn(garminService, 'handleDeauthorizeWebhook').mockResolvedValueOnce(undefined);

      const response = await request(app.callback()).post('/garmin/webhook/deauthorize').send({ invalid: 'input' });

      expect(response.status).toBe(400);
    });

    it('handles webhook', async () => {
      jest.spyOn(garminService, 'handleDeauthorizeWebhook').mockResolvedValueOnce(undefined);

      const body: { deregistrations: { userId: string; userAccessToken: string }[] } = {
        deregistrations: [],
      };
      const response = await request(app.callback()).post('/garmin/webhook/deauthorize').send(body);

      expect(response.status).toBe(200);
      expect(garminService.handleDeauthorizeWebhook).toBeCalledTimes(1);
    });
  });
});
