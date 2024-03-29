import { Server } from 'http';

import supertest from 'supertest';
import TestAgent from 'supertest/lib/agent';

import { app } from '../../../../src/app';
import log from '../../../../src/helpers/logger';
import { activityService } from '../../../../src/server/activities/activity.service';
import { authenticated } from '../../../utils';

describe('Activities Controller', () => {
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

  describe('GET /users/:userId/activities', () => {
    it('requires an authenticated user', async () => {
      const response = await request.get('/users/1/activities');

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(request.get('/users/1/activities'), 2);

      expect(response.status).toBe(403);
    });

    it('validates input', async () => {
      jest.spyOn(activityService, 'getActivities');

      const response = await authenticated(request.get('/users/1/activities?lang=1'), 1);

      expect(response.status).toBe(400);
      expect(activityService.getActivities).not.toHaveBeenCalled();
    });

    it('responds with user activities summaries', async () => {
      jest.spyOn(activityService, 'getActivities').mockResolvedValueOnce([
        {
          id: 1,
          userId: 1,
          vendor: 'strava',
          vendorId: '1',
          date: '2022-01-01T00:00:01Z',
          type: { en: 'Run', fr: 'Course à pied' },
          name: 'name',
        },
      ]);

      const response = await authenticated(request.get('/users/1/activities'), 1);

      expect(response.status).toBe(200);
      expect(response.body).toMatchInlineSnapshot(`
        [
          {
            "date": "2022-01-01T00:00:01Z",
            "id": 1,
            "name": "name",
            "type": {
              "en": "Run",
              "fr": "Course à pied",
            },
            "userId": 1,
            "vendor": "strava",
            "vendorId": "1",
          },
        ]
      `);
      expect(activityService.getActivities).toHaveBeenCalledTimes(1);
      expect(activityService.getActivities).toHaveBeenCalledWith(1, undefined);
    });

    it('responds with user activities summaries with specific lang', async () => {
      jest.spyOn(activityService, 'getActivities').mockResolvedValueOnce([
        {
          id: 1,
          userId: 1,
          vendor: 'strava',
          vendorId: '1',
          date: '2022-01-01T00:00:01Z',
          type: { en: 'Run' },
          name: 'name',
        },
      ]);

      const response = await authenticated(request.get('/users/1/activities?lang=en'), 1);

      expect(response.status).toBe(200);
      expect(response.body).toMatchInlineSnapshot(`
        [
          {
            "date": "2022-01-01T00:00:01Z",
            "id": 1,
            "name": "name",
            "type": {
              "en": "Run",
            },
            "userId": 1,
            "vendor": "strava",
            "vendorId": "1",
          },
        ]
      `);
      expect(activityService.getActivities).toHaveBeenCalledTimes(1);
      expect(activityService.getActivities).toHaveBeenCalledWith(1, 'en');
    });
  });

  describe('GET users/:userId/activities/:activityId/geometry', () => {
    it('requires an authenticated user', async () => {
      const response = await request.get('/users/1/activities/1/geometry');

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(request.get('/users/1/activities/1/geometry'), 2);

      expect(response.status).toBe(403);
    });

    it('returns  404 if no geometry can be retrieved', async () => {
      jest.spyOn(activityService, 'getActivityGeometry').mockResolvedValueOnce(undefined);

      const response = await authenticated(request.get('/users/1/activities/1/geometry'), 1);

      expect(response.status).toBe(404);
    });

    it('returns geometry', async () => {
      jest
        .spyOn(activityService, 'getActivityGeometry')
        .mockResolvedValueOnce({ type: 'LineString', coordinates: [[1, 1, 1, 1]] });

      const response = await authenticated(request.get('/users/1/activities/1/geometry'), 1);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ type: 'LineString', coordinates: [[1, 1, 1, 1]] });
    });
  });
});
