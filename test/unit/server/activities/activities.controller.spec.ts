import request from 'supertest';

import { app } from '../../../../src/app';
import type { Activity } from '../../../../src/repository/activity';
import { activityService } from '../../../../src/server/activities/activity.service';
import { stravaService } from '../../../../src/server/strava/strava.service';
import { suuntoService } from '../../../../src/server/suunto/suunto.service';
import { userService } from '../../../../src/user.service';
import { authenticated } from '../../../utils';

describe('Activities Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    it('returns 404 if activity does not exist', async () => {
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce(undefined);

      const response = await authenticated(request(app.callback()).get('/users/1/activities/1'), 1);

      expect(response.status).toBe(404);
    });

    it('returns geojson from DB if already present', async () => {
      jest.spyOn(stravaService, 'getToken');
      jest.spyOn(suuntoService, 'getToken');
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce({
        id: 1,
        userId: 1,
        vendor: 'garmin',
        vendorId: 'vendorId',
        type: 'RUN',
        date: '2022-01-01T00:00:01Z',
        geojson: {
          type: 'LineString',
          coordinates: [[0.0, 0.0, 220]],
        },
      });

      const response = await authenticated(request(app.callback()).get('/users/1/activities/1'), 1);

      expect(response.status).toBe(200);
      expect(response.body).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              0,
              0,
              220,
            ],
          ],
          "type": "LineString",
        }
      `);
      expect(stravaService.getToken).not.toHaveBeenCalled();
      expect(suuntoService.getToken).not.toHaveBeenCalled();
    });

    it('retrieves geojson from strava', async () => {
      const activity: Activity = {
        id: 1,
        userId: 1,
        vendor: 'strava',
        vendorId: 'vendorId',
        type: 'RUN',
        date: '2022-01-01T00:00:01Z',
      };
      jest.spyOn(stravaService, 'getToken').mockResolvedValueOnce('token');
      jest.spyOn(stravaService, 'getActivityStream').mockResolvedValueOnce([]);
      jest.spyOn(activityService, 'stravaStreamSetToGeoJSON').mockReturnValueOnce({
        type: 'LineString',
        coordinates: [[0.0, 0.0, 220]],
      });
      jest.spyOn(suuntoService, 'getToken');
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce(activity);

      const response = await authenticated(request(app.callback()).get('/users/1/activities/1'), 1);

      expect(response.status).toBe(200);
      expect(response.body).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              0,
              0,
              220,
            ],
          ],
          "type": "LineString",
        }
      `);
      expect(stravaService.getToken).toBeCalledTimes(1);
      expect(stravaService.getToken).toBeCalledWith(1);
      expect(stravaService.getActivityStream).toBeCalledTimes(1);
      expect(stravaService.getActivityStream).toBeCalledWith('token', 'vendorId');
      expect(activityService.stravaStreamSetToGeoJSON).toBeCalledTimes(1);
      expect(activityService.stravaStreamSetToGeoJSON).toBeCalledWith(activity, []);
      expect(suuntoService.getToken).not.toHaveBeenCalled();
    });

    it('returns 503 if geojson cannot be retrieved from strava', async () => {
      jest.spyOn(stravaService, 'getToken').mockResolvedValueOnce(undefined);
      jest.spyOn(stravaService, 'getActivityStream');
      jest.spyOn(suuntoService, 'getToken');
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce({
        id: 1,
        userId: 1,
        vendor: 'strava',
        vendorId: 'vendorId',
        type: 'RUN',
        date: '2022-01-01T00:00:01Z',
      });

      const response = await authenticated(request(app.callback()).get('/users/1/activities/1'), 1);

      expect(response.status).toBe(503);
      expect(stravaService.getToken).toBeCalledTimes(1);
      expect(stravaService.getToken).toBeCalledWith(1);
      expect(stravaService.getActivityStream).not.toHaveBeenCalled();
      expect(suuntoService.getToken).not.toHaveBeenCalled();
    });

    it('returns geojson from suunto', async () => {
      const fitBin = new Uint8Array();
      jest.spyOn(stravaService, 'getToken');
      jest.spyOn(suuntoService, 'getToken').mockResolvedValueOnce('token');
      jest.spyOn(suuntoService, 'getFIT').mockResolvedValue(fitBin);
      jest.spyOn(activityService, 'fitToGeoJSON').mockReturnValueOnce({
        type: 'LineString',
        coordinates: [[0.0, 0.0, 220]],
      });
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce({
        id: 1,
        userId: 1,
        vendor: 'suunto',
        vendorId: 'vendorId',
        type: 'RUN',
        date: '2022-01-01T00:00:01Z',
      });

      const response = await authenticated(request(app.callback()).get('/users/1/activities/1'), 1);

      expect(response.status).toBe(200);
      expect(response.body).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              0,
              0,
              220,
            ],
          ],
          "type": "LineString",
        }
      `);
      expect(stravaService.getToken).not.toHaveBeenCalled();
      expect(suuntoService.getToken).toBeCalledTimes(1);
      expect(suuntoService.getToken).toBeCalledWith(1);
      expect(suuntoService.getToken).toBeCalledTimes(1);
      expect(suuntoService.getToken).toBeCalledWith(1);
      expect(activityService.fitToGeoJSON).toBeCalledTimes(1);
      expect(activityService.fitToGeoJSON).toBeCalledWith(fitBin);
    });

    it('returns 503 if geojson cannot be retrieved from suunto', async () => {
      jest.spyOn(stravaService, 'getToken');
      jest.spyOn(suuntoService, 'getToken').mockResolvedValueOnce(undefined);
      jest.spyOn(suuntoService, 'getFIT');
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce({
        id: 1,
        userId: 1,
        vendor: 'suunto',
        vendorId: 'vendorId',
        type: 'RUN',
        date: '2022-01-01T00:00:01Z',
      });

      const response = await authenticated(request(app.callback()).get('/users/1/activities/1'), 1);

      expect(response.status).toBe(503);
      expect(stravaService.getToken).not.toHaveBeenCalled();
      expect(suuntoService.getToken).toBeCalledTimes(1);
      expect(suuntoService.getToken).toBeCalledWith(1);
      expect(suuntoService.getFIT).not.toHaveBeenCalled();
    });

    it('throws if FIT cannot be converted to geojson', async () => {
      const fitBin = new Uint8Array();
      jest.spyOn(stravaService, 'getToken');
      jest.spyOn(suuntoService, 'getToken').mockResolvedValueOnce('token');
      jest.spyOn(suuntoService, 'getFIT').mockResolvedValue(fitBin);
      jest.spyOn(activityService, 'fitToGeoJSON').mockImplementationOnce(() => {
        throw new Error();
      });
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce({
        id: 1,
        userId: 1,
        vendor: 'suunto',
        vendorId: 'vendorId',
        type: 'RUN',
        date: '2022-01-01T00:00:01Z',
      });

      const response = await authenticated(request(app.callback()).get('/users/1/activities/1'), 1);

      expect(response.status).toBe(500);
      expect(stravaService.getToken).not.toHaveBeenCalled();
      expect(suuntoService.getToken).toBeCalledTimes(1);
      expect(suuntoService.getToken).toBeCalledWith(1);
      expect(suuntoService.getToken).toBeCalledTimes(1);
      expect(suuntoService.getToken).toBeCalledWith(1);
      expect(activityService.fitToGeoJSON).toHaveBeenCalledTimes(1);
    });

    it('throws if geojson is not present for garmin activity', async () => {
      jest.spyOn(stravaService, 'getToken');
      jest.spyOn(suuntoService, 'getToken');
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce({
        id: 1,
        userId: 1,
        vendor: 'garmin',
        vendorId: 'vendorId',
        type: 'RUN',
        date: '2022-01-01T00:00:01Z',
      });

      const response = await authenticated(request(app.callback()).get('/users/1/activities/1'), 1);

      expect(response.status).toBe(500);
      expect(stravaService.getToken).not.toHaveBeenCalled();
      expect(suuntoService.getToken).not.toHaveBeenCalled();
    });
  });
});
