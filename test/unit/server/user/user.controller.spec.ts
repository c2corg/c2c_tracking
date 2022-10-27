import request from 'supertest';

import { app } from '../../../../src/app';
import log from '../../../../src/helpers/logger';
import { userService } from '../../../../src/user.service';
import { authenticated } from '../../../utils';

describe('User Controller', () => {
  beforeEach(() => {
    jest.spyOn(log, 'info').mockImplementation(() => Promise.resolve());
    jest.spyOn(log, 'warn').mockImplementation(() => Promise.resolve());
  });

  describe('GET /users/:userId/status', () => {
    it('requires an authenticated user', async () => {
      const response = await request(app.callback()).get('/users/1/status');

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(request(app.callback()).get('/users/1/status'), 2);

      expect(response.status).toBe(403);
    });

    it('responds with user activities summaries', async () => {
      jest.spyOn(userService, 'getUserInfo').mockResolvedValueOnce({
        decathlon: 'configured',
        garmin: 'not-configured',
        strava: 'token-lost',
        suunto: 'configured',
      });

      const response = await authenticated(request(app.callback()).get('/users/1/status'), 1);

      expect(response.status).toBe(200);
      expect(response.body).toMatchInlineSnapshot(`
        {
          "decathlon": "configured",
          "garmin": "not-configured",
          "strava": "token-lost",
          "suunto": "configured",
        }
      `);
      expect(userService.getUserInfo).toBeCalledTimes(1);
      expect(userService.getUserInfo).toBeCalledWith('1');
    });
  });
});
