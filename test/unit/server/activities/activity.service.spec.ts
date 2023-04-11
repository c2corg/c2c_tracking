import { NotFoundError } from '../../../../src/errors.js';
import log from '../../../../src/helpers/logger.js';
import { ActivityService } from '../../../../src/server/activities/activity.service.js';
import { stravaService } from '../../../../src/server/strava/strava.service.js';
import { suuntoService } from '../../../../src/server/suunto/suunto.service.js';
import { userService } from '../../../../src/user.service.js';

jest.mock('../../../../src/helpers/utils');

describe('Activity Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getActivities', () => {
    it('returns all translations if lang is not specified', async () => {
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

      const service = new ActivityService();
      const response = await service.getActivities(1);

      expect(response).toMatchInlineSnapshot(`
        [
          {
            "date": "2022-01-01T00:00:01Z",
            "id": 1,
            "name": "name",
            "type": {
              "ca": "Run",
              "de": "Run",
              "en": "Run",
              "es": "Run",
              "eu": "Run",
              "fr": "Course à pied",
              "hu": "Run",
              "it": "Run",
              "ru": "Run",
              "sl": "Run",
              "zh_CN": "Run",
            },
            "userId": 1,
            "vendor": "strava",
            "vendorId": "1",
          },
        ]
      `);
      expect(userService.getActivities).toHaveBeenCalledTimes(1);
      expect(userService.getActivities).toHaveBeenCalledWith(1);
    });

    it('returns only specific lang if specified', async () => {
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

      const service = new ActivityService();
      const response = await service.getActivities(1, 'fr');

      expect(response).toMatchInlineSnapshot(`
        [
          {
            "date": "2022-01-01T00:00:01Z",
            "id": 1,
            "name": "name",
            "type": {
              "fr": "Course à pied",
            },
            "userId": 1,
            "vendor": "strava",
            "vendorId": "1",
          },
        ]
      `);
      expect(userService.getActivities).toHaveBeenCalledTimes(1);
      expect(userService.getActivities).toHaveBeenCalledWith(1);
    });

    it('defaults to unknown if i18n key is not found', async () => {
      jest.spyOn(userService, 'getActivities').mockResolvedValueOnce([
        {
          id: 1,
          userId: 1,
          vendor: 'strava',
          vendorId: '1',
          date: '2022-01-01T00:00:01Z',
          type: 'whut?',
          name: 'name',
        },
      ]);

      const service = new ActivityService();
      const response = await service.getActivities(1, 'fr');

      expect(response).toMatchInlineSnapshot(`
        [
          {
            "date": "2022-01-01T00:00:01Z",
            "id": 1,
            "name": "name",
            "type": {
              "fr": "Inconnu",
            },
            "userId": 1,
            "vendor": "strava",
            "vendorId": "1",
          },
        ]
      `);
      expect(userService.getActivities).toHaveBeenCalledTimes(1);
      expect(userService.getActivities).toHaveBeenCalledWith(1);
    });
  });

  describe('getActivityGeometry', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(log, 'info').mockImplementation(() => {
        /* do nothing */
      });
      jest.spyOn(log, 'warn').mockImplementation(() => {
        /* do nothing */
      });
    });

    it('throws if activity does not exist', async () => {
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce(undefined);

      const service = new ActivityService();
      await expect(service.getActivityGeometry(1, 1)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('returns geojson from DB if present', async () => {
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

      const service = new ActivityService();
      const response = await service.getActivityGeometry(1, 1);

      expect(response).toEqual({
        type: 'LineString',
        coordinates: [[0, 0, 220]],
      });
      expect(stravaService.getToken).not.toHaveBeenCalled();
      expect(suuntoService.getToken).not.toHaveBeenCalled();
    });

    it('returns undefined if geojson is not present for activity', async () => {
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

      const service = new ActivityService();
      const response = await service.getActivityGeometry(1, 1);

      expect(response).toBeUndefined();
    });
  });
});
