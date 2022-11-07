import * as fitParser from '@c2corg/fit-parser-extract-geometry';

import { NotFoundError } from '../../../../src/errors';
import log from '../../../../src/helpers/logger';
import type { Activity } from '../../../../src/repository/activity';
import { activityRepository } from '../../../../src/repository/activity.repository';
import { ActivityService } from '../../../../src/server/activities/activity.service';
import { decathlonService } from '../../../../src/server/decathlon/decathlon.service';
import { stravaService } from '../../../../src/server/strava/strava.service';
import { suuntoService } from '../../../../src/server/suunto/suunto.service';
import { userService } from '../../../../src/user.service';

jest.mock('@c2corg/fit-parser-extract-geometry');

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
      expect(userService.getActivities).toBeCalledTimes(1);
      expect(userService.getActivities).toBeCalledWith(1);
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
      expect(userService.getActivities).toBeCalledTimes(1);
      expect(userService.getActivities).toBeCalledWith(1);
    });
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
    expect(userService.getActivities).toBeCalledTimes(1);
    expect(userService.getActivities).toBeCalledWith(1);
  });

  describe('getActivityGeometry', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(log, 'info').mockImplementation(() => Promise.resolve());
      jest.spyOn(log, 'warn').mockImplementation(() => Promise.resolve());
    });

    it('throws if activity does not exist', async () => {
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce(undefined);

      const service = new ActivityService();
      await expect(service.getActivityGeometry(1, 1)).rejects.toBeInstanceOf(NotFoundError);
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

      const service = new ActivityService();
      const response = await service.getActivityGeometry(1, 1);

      expect(response).toEqual({
        type: 'LineString',
        coordinates: [[0, 0, 220]],
      });
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
      jest.spyOn(activityRepository, 'update').mockResolvedValueOnce({} as Activity);
      jest.spyOn(suuntoService, 'getToken');
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce(activity);

      const stravaStreamSetToGeoJSONMock = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(ActivityService.prototype as any, 'stravaStreamSetToGeoJSON')
        .mockReturnValueOnce({
          type: 'LineString',
          coordinates: [[0.0, 0.0, 220]],
        });

      const service = new ActivityService();
      const response = await service.getActivityGeometry(1, 1);

      expect(response).toEqual({
        type: 'LineString',
        coordinates: [[0.0, 0.0, 220]],
      });
      expect(stravaService.getToken).toBeCalledTimes(1);
      expect(stravaService.getToken).toBeCalledWith(1);
      expect(stravaService.getActivityStream).toBeCalledTimes(1);
      expect(stravaService.getActivityStream).toBeCalledWith('token', 'vendorId');
      expect(stravaStreamSetToGeoJSONMock).toBeCalledTimes(1);
      expect(stravaStreamSetToGeoJSONMock).toBeCalledWith(activity, []);
      expect(activityRepository.update).toBeCalledTimes(1);
      expect(activityRepository.update).toBeCalledWith({
        ...activity,
        geojson: { coordinates: [[0, 0, 220]], type: 'LineString' },
      });
      expect(suuntoService.getToken).not.toHaveBeenCalled();

      stravaStreamSetToGeoJSONMock.mockRestore();
    });

    it('throws if no token can be retrieved', async () => {
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

      const service = new ActivityService();
      await expect(service.getActivityGeometry(1, 1)).rejects.toMatchInlineSnapshot(
        '[Error: Unable to acquire valid token]',
      );

      expect(stravaService.getToken).toBeCalledTimes(1);
      expect(stravaService.getToken).toBeCalledWith(1);
      expect(stravaService.getActivityStream).not.toHaveBeenCalled();
      expect(suuntoService.getToken).not.toHaveBeenCalled();
    });

    it('throws if geojson is not present', async () => {
      jest.spyOn(stravaService, 'getToken').mockResolvedValueOnce('token');
      jest.spyOn(stravaService, 'getActivityStream').mockRejectedValueOnce(undefined);
      jest.spyOn(suuntoService, 'getToken');
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce({
        id: 1,
        userId: 1,
        vendor: 'strava',
        vendorId: 'vendorId',
        type: 'RUN',
        date: '2022-01-01T00:00:01Z',
      });

      const service = new ActivityService();
      await expect(service.getActivityGeometry(1, 1)).rejects.toBeInstanceOf(NotFoundError);

      expect(stravaService.getToken).toBeCalledTimes(1);
      expect(stravaService.getToken).toBeCalledWith(1);
      expect(stravaService.getActivityStream).toHaveBeenCalledTimes(1);
      expect(stravaService.getActivityStream).toHaveBeenCalledWith('token', 'vendorId');
      expect(suuntoService.getToken).not.toHaveBeenCalled();
    });

    it('returns geojson from suunto', async () => {
      const fitBin = new Uint8Array();
      jest.spyOn(stravaService, 'getToken');
      jest.spyOn(suuntoService, 'getToken').mockResolvedValueOnce('token');
      jest.spyOn(suuntoService, 'getFIT').mockResolvedValue(fitBin);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fitToGeoJSONMock = jest.spyOn(ActivityService.prototype as any, 'fitToGeoJSON').mockReturnValueOnce({
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
      jest.spyOn(activityRepository, 'update').mockResolvedValueOnce({} as Activity);

      const service = new ActivityService();
      const response = await service.getActivityGeometry(1, 1);

      expect(response).toEqual({
        type: 'LineString',
        coordinates: [[0.0, 0.0, 220]],
      });
      expect(stravaService.getToken).not.toHaveBeenCalled();
      expect(suuntoService.getToken).toBeCalledTimes(1);
      expect(suuntoService.getToken).toBeCalledWith(1);
      expect(suuntoService.getToken).toBeCalledTimes(1);
      expect(suuntoService.getToken).toBeCalledWith(1);
      expect(fitToGeoJSONMock).toBeCalledTimes(1);
      expect(fitToGeoJSONMock).toBeCalledWith(fitBin);

      fitToGeoJSONMock.mockRestore();
    });

    it('throws if no token can be retrieved', async () => {
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

      const service = new ActivityService();
      await expect(service.getActivityGeometry(1, 1)).rejects.toMatchInlineSnapshot(
        '[Error: Unable to acquire valid token]',
      );

      expect(stravaService.getToken).not.toHaveBeenCalled();
      expect(suuntoService.getToken).toBeCalledTimes(1);
      expect(suuntoService.getToken).toBeCalledWith(1);
      expect(suuntoService.getFIT).not.toHaveBeenCalled();
    });

    it('throws if geometry cannot be retrieved from suunto', async () => {
      jest.spyOn(stravaService, 'getToken');
      jest.spyOn(suuntoService, 'getToken').mockResolvedValueOnce('token');
      jest.spyOn(suuntoService, 'getFIT').mockRejectedValueOnce(undefined);
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce({
        id: 1,
        userId: 1,
        vendor: 'suunto',
        vendorId: 'vendorId',
        type: 'RUN',
        date: '2022-01-01T00:00:01Z',
      });

      const service = new ActivityService();
      await expect(service.getActivityGeometry(1, 1)).rejects.toBeInstanceOf(NotFoundError);

      expect(stravaService.getToken).not.toHaveBeenCalled();
      expect(suuntoService.getToken).toBeCalledTimes(1);
      expect(suuntoService.getToken).toBeCalledWith(1);
      expect(suuntoService.getFIT).toBeCalledTimes(1);
      expect(suuntoService.getFIT).toBeCalledWith('token', 'vendorId');
    });

    it('throws if FIT cannot be converted to geojson', async () => {
      const fitBin = new Uint8Array();
      jest.spyOn(stravaService, 'getToken');
      jest.spyOn(suuntoService, 'getToken').mockResolvedValueOnce('token');
      jest.spyOn(suuntoService, 'getFIT').mockResolvedValue(fitBin);
      const fitToGeoJSONMock = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(ActivityService.prototype as any, 'fitToGeoJSON')
        .mockImplementationOnce(() => {
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

      const service = new ActivityService();
      await expect(service.getActivityGeometry(1, 1)).rejects.toBeInstanceOf(NotFoundError);

      expect(stravaService.getToken).not.toHaveBeenCalled();
      expect(suuntoService.getToken).toBeCalledTimes(1);
      expect(suuntoService.getToken).toBeCalledWith(1);
      expect(suuntoService.getToken).toBeCalledTimes(1);
      expect(suuntoService.getToken).toBeCalledWith(1);
      expect(fitToGeoJSONMock).toHaveBeenCalledTimes(1);

      fitToGeoJSONMock.mockRestore();
    });

    it('retrieves geojson from decathlon', async () => {
      const activity: Activity = {
        id: 1,
        userId: 1,
        vendor: 'decathlon',
        vendorId: 'vendorId',
        type: 'Bicycle',
        date: '2022-01-01T00:00:01Z',
      };
      jest.spyOn(decathlonService, 'getToken').mockResolvedValueOnce('token');
      jest.spyOn(decathlonService, 'getActivityGeometry').mockResolvedValueOnce({
        type: 'LineString',
        coordinates: [[0.0, 0.0, 220]],
      });
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce(activity);
      jest.spyOn(activityRepository, 'update').mockResolvedValueOnce({} as Activity);

      const service = new ActivityService();
      const response = await service.getActivityGeometry(1, 1);

      expect(response).toEqual({
        type: 'LineString',
        coordinates: [[0.0, 0.0, 220]],
      });
      expect(decathlonService.getToken).toBeCalledTimes(1);
      expect(decathlonService.getToken).toBeCalledWith(1);
      expect(decathlonService.getActivityGeometry).toBeCalledTimes(1);
      expect(decathlonService.getActivityGeometry).toBeCalledWith('token', 'vendorId');
    });

    it('throws if no token can be retrieved', async () => {
      jest.spyOn(decathlonService, 'getToken').mockResolvedValueOnce(undefined);
      jest.spyOn(suuntoService, 'getToken');
      jest.spyOn(decathlonService, 'getActivityGeometry');
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce({
        id: 1,
        userId: 1,
        vendor: 'decathlon',
        vendorId: 'vendorId',
        type: 'Bicycle',
        date: '2022-01-01T00:00:01Z',
      });

      const service = new ActivityService();
      await expect(service.getActivityGeometry(1, 1)).rejects.toMatchInlineSnapshot(
        '[Error: Unable to acquire valid token]',
      );

      expect(decathlonService.getToken).toBeCalledTimes(1);
      expect(decathlonService.getToken).toBeCalledWith(1);
      expect(decathlonService.getActivityGeometry).not.toHaveBeenCalled();
      expect(suuntoService.getToken).not.toHaveBeenCalled();
    });

    it('throws if geometry cannot be retrieved from decathon', async () => {
      jest.spyOn(decathlonService, 'getToken').mockResolvedValueOnce('token');
      jest.spyOn(suuntoService, 'getToken');
      jest.spyOn(decathlonService, 'getActivityGeometry').mockRejectedValueOnce(undefined);
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce({
        id: 1,
        userId: 1,
        vendor: 'decathlon',
        vendorId: 'vendorId',
        type: 'Bicycle',
        date: '2022-01-01T00:00:01Z',
      });

      const service = new ActivityService();
      await expect(service.getActivityGeometry(1, 1)).rejects.toBeInstanceOf(NotFoundError);

      expect(decathlonService.getToken).toBeCalledTimes(1);
      expect(decathlonService.getToken).toBeCalledWith(1);
      expect(decathlonService.getActivityGeometry).toBeCalledTimes(1);
      expect(decathlonService.getActivityGeometry).toBeCalledWith('token', 'vendorId');
      expect(suuntoService.getToken).not.toBeCalled();
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

      const service = new ActivityService();
      await expect(service.getActivityGeometry(1, 1)).rejects.toMatchInlineSnapshot(
        '[Error: Unable to acquire Garmin geometry]',
      );

      expect(stravaService.getToken).not.toHaveBeenCalled();
      expect(suuntoService.getToken).not.toHaveBeenCalled();
    });

    it('does not fail if geojson cannot be saved in db', async () => {
      const activity: Activity = {
        id: 1,
        userId: 1,
        vendor: 'decathlon',
        vendorId: 'vendorId',
        type: 'Bicycle',
        date: '2022-01-01T00:00:01Z',
      };
      jest.spyOn(decathlonService, 'getToken').mockResolvedValueOnce('token');
      jest.spyOn(decathlonService, 'getActivityGeometry').mockResolvedValueOnce({
        type: 'LineString',
        coordinates: [[0.0, 0.0, 220]],
      });
      jest.spyOn(userService, 'getActivity').mockResolvedValueOnce(activity);
      jest.spyOn(activityRepository, 'update').mockRejectedValueOnce(undefined);

      const service = new ActivityService();
      const response = await service.getActivityGeometry(1, 1);

      expect(response).toEqual({
        type: 'LineString',
        coordinates: [[0.0, 0.0, 220]],
      });
      expect(activityRepository.update).toBeCalledTimes(1);
    });
  });

  describe('suuntoFitToGeoJSON', () => {
    it('throws if FIT activity has no records', async () => {
      jest.mocked(fitParser).extractGeometry.mockReturnValueOnce([]);
      const service = new ActivityService();
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).fitToGeoJSON(new ArrayBuffer(0));
      }).toThrowErrorMatchingInlineSnapshot(`"Available data cannot be converted to a valid geometry"`);
    });

    it('retrieves geometry from FIT', () => {
      const service = new ActivityService();
      jest.mocked(fitParser).extractGeometry.mockReturnValueOnce([[1, 2, 3, 4]]);
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).fitToGeoJSON(new ArrayBuffer(0)),
      ).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              1,
              2,
              3,
              4,
            ],
          ],
          "type": "LineString",
        }
      `);
    });
  });

  describe('stravaStreamSetToGeoJSON', () => {
    const activity: Activity = {
      id: 1,
      userId: 1,
      vendor: 'strava',
      vendorId: 'vendorId',
      date: '1970-01-01T00:00:01Z',
      type: 'RUN',
    };

    it('throws if streamset has no distance stream', () => {
      const service = new ActivityService();
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).stravaStreamSetToGeoJSON(activity, [
          {
            type: 'time',
            series_type: 'time',
            original_size: 2,
            resolution: 'high',
            data: [1, 2],
          },

          {
            type: 'latlng',
            series_type: 'time',
            original_size: 2,
            resolution: 'high',
            data: [
              [1.0, 1.0],
              [2.0, 2.0],
            ],
          },
        ]);
      }).toThrowErrorMatchingInlineSnapshot(`"Available data cannot be converted to a valid geometry"`);
    });

    it('throws if streamset has no latlng stream', () => {
      const service = new ActivityService();
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).stravaStreamSetToGeoJSON(activity, [
          {
            type: 'time',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [1, 2],
          },

          {
            type: 'distance',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [1, 2],
          },
        ]);
      }).toThrowErrorMatchingInlineSnapshot(`"Available data cannot be converted to a valid geometry"`);
    });

    it('throws if streams are not all synchronized with distance stream', () => {
      const service = new ActivityService();
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).stravaStreamSetToGeoJSON(activity, [
          {
            type: 'distance',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [1, 2],
          },

          {
            type: 'time',
            series_type: 'time',
            original_size: 2,
            resolution: 'high',
            data: [1, 2],
          },

          {
            type: 'latlng',
            series_type: 'time',
            original_size: 2,
            resolution: 'high',
            data: [
              [1.0, 1.0],
              [2.0, 2.0],
            ],
          },
        ]);
      }).toThrowErrorMatchingInlineSnapshot(`"Available data cannot be converted to a valid geometry"`);
    });

    it('throws if streams are not all of same size', () => {
      const service = new ActivityService();
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).stravaStreamSetToGeoJSON(activity, [
          {
            type: 'distance',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [1, 2],
          },

          {
            type: 'time',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [1, 2],
          },

          {
            type: 'latlng',
            series_type: 'distance',
            original_size: 1,
            resolution: 'high',
            data: [[1.0, 1.0]],
          },
        ]);
      }).toThrowErrorMatchingInlineSnapshot(`"Available data cannot be converted to a valid geometry"`);
    });

    it('converts streamset to geojson', () => {
      const service = new ActivityService();
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).stravaStreamSetToGeoJSON(activity, [
          {
            type: 'distance',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [1, 2],
          },

          {
            type: 'time',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [1, 2],
          },

          {
            type: 'latlng',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [
              [1.0, 1.0],
              [2.0, 2.0],
            ],
          },

          {
            type: 'altitude',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [1, 2],
          },
        ]),
      ).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              1,
              1,
              1,
              2,
            ],
            [
              2,
              2,
              2,
              3,
            ],
          ],
          "type": "LineString",
        }
      `);
    });

    it('converts streamset to geojson without altitude', () => {
      const service = new ActivityService();
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).stravaStreamSetToGeoJSON(activity, [
          {
            type: 'distance',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [1, 2],
          },

          {
            type: 'time',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [1, 2],
          },

          {
            type: 'latlng',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [
              [1.0, 1.0],
              [2.0, 2.0],
            ],
          },
        ]),
      ).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              1,
              1,
              2,
            ],
            [
              2,
              2,
              3,
            ],
          ],
          "type": "LineString",
        }
      `);
    });

    it('converts streamset to geojson without timestamp', () => {
      const service = new ActivityService();
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).stravaStreamSetToGeoJSON(activity, [
          {
            type: 'distance',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [1, 2],
          },

          {
            type: 'latlng',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [
              [1.0, 1.0],
              [2.0, 2.0],
            ],
          },

          {
            type: 'altitude',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [1, 2],
          },
        ]),
      ).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              1,
              1,
              1,
            ],
            [
              2,
              2,
              2,
            ],
          ],
          "type": "LineString",
        }
      `);
    });

    it('converts streamset to geojson without timestamp and altitude', () => {
      const service = new ActivityService();
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).stravaStreamSetToGeoJSON(activity, [
          {
            type: 'distance',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [1, 2],
          },

          {
            type: 'latlng',
            series_type: 'distance',
            original_size: 2,
            resolution: 'high',
            data: [
              [1.0, 1.0],
              [2.0, 2.0],
            ],
          },
        ]),
      ).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              1,
              1,
            ],
            [
              2,
              2,
            ],
          ],
          "type": "LineString",
        }
      `);
    });
  });
});
