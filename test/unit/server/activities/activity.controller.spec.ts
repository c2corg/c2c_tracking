import request from 'supertest';

import { app } from '../../../../src/app';
import log from '../../../../src/helpers/logger';
import { activityService } from '../../../../src/server/activities/activity.service';
import { userService } from '../../../../src/user.service';
import { authenticated } from '../../../utils';

describe('Activities Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(log, 'info').mockImplementation(() => Promise.resolve());
    jest.spyOn(log, 'warn').mockImplementation(() => Promise.resolve());
  });

  describe('GET /users/:userId/activities', () => {
    it('requires an authenticated user', async () => {
      const response = await request(app.callback()).get('/users/1/activities');

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(request(app.callback()).get('/users/1/activities'), 2);

      expect(response.status).toBe(403);
    });

    it('responds with user activities summaries', async () => {
      jest.spyOn(userService, 'getActivities').mockResolvedValueOnce([
        {
          id: 1,
          userId: 1,
          vendor: 'strava',
          vendorId: '1',
          date: '2022-01-01T00:00:01Z',
          type: 'RUN',
          name: 'name',
        },
      ]);

      const response = await authenticated(request(app.callback()).get('/users/1/activities'), 1);

      expect(response.status).toBe(200);
      expect(response.body).toMatchInlineSnapshot(`
        [
          {
            "date": "2022-01-01T00:00:01Z",
            "id": 1,
            "name": "name",
            "type": "RUN",
            "userId": 1,
            "vendor": "strava",
          },
        ]
      `);
      expect(userService.getActivities).toBeCalledTimes(1);
      expect(userService.getActivities).toBeCalledWith(1);
    });
  });

  describe('GET users/:userId/activities/:activityId', () => {
    it('requires an authenticated user', async () => {
      const response = await request(app.callback()).get('/users/1/activities/1');

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(request(app.callback()).get('/users/1/activities/1'), 2);

      expect(response.status).toBe(403);
    });

    it('returns  404 if no geometry can be retrieved', async () => {
      jest.spyOn(activityService, 'getActivity').mockResolvedValueOnce(undefined);

      const response = await authenticated(request(app.callback()).get('/users/1/activities/1'), 1);

      expect(response.status).toBe(404);
    });

    it('returns geometry', async () => {
      jest
        .spyOn(activityService, 'getActivity')
        .mockResolvedValueOnce({ type: 'LineString', coordinates: [[1, 1, 1, 1]] });

      const response = await authenticated(request(app.callback()).get('/users/1/activities/1'), 1);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ type: 'LineString', coordinates: [[1, 1, 1, 1]] });
    });
  });
});
