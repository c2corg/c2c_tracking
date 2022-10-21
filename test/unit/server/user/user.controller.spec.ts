import request from 'supertest';

import { app } from '../../../../src/app';
import { userService } from '../../../../src/user.service';
import { authenticated } from '../../../utils';

describe('User Controller', () => {
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
        decathlon: false,
        garmin: false,
        strava: true,
        suunto: true,
      });

      const response = await authenticated(request(app.callback()).get('/users/1/status'), 1);

      expect(response.status).toBe(200);
      expect(response.body).toMatchInlineSnapshot(`
        {
          "decathlon": false,
          "garmin": false,
          "strava": true,
          "suunto": true,
        }
      `);
      expect(userService.getUserInfo).toBeCalledTimes(1);
      expect(userService.getUserInfo).toBeCalledWith('1');
    });
  });
});
