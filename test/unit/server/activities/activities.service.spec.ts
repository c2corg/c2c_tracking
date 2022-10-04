import type { Activity } from '../../../../src/repository/activity';
import { ActivityService } from '../../../../src/server/activities/activity.service';

describe('Activity Service', () => {
  describe('suuntoFitToGeoJSON', () => {
    it('throws if FIT activity has no records', async () => {
      const service = new ActivityService();
      expect(() => {
        service.suuntoFitToGeoJSON({
          activity: {},
          other: {},
        });
      }).toThrowErrorMatchingInlineSnapshot(`"Available data cannot be converted to a valid geometry"`);
    });

    it('converts records to coordinates', () => {
      const service = new ActivityService();
      expect(
        service.suuntoFitToGeoJSON({
          activity: {
            records: [
              {
                position_long: 1.0,
                position_lat: 1.0,
                altitude: 1,
                timestamp: new Date('1970-01-01T00:00:01Z'),
              },
            ],
          },

          other: {},
        }),
      ).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              1,
              1,
              1,
              1,
            ],
          ],
          "type": "LineString",
        }
      `);
    });

    it('filters out records without coordinates', () => {
      const service = new ActivityService();
      expect(
        service.suuntoFitToGeoJSON({
          activity: {
            records: [
              {
                position_long: 1.0,
                position_lat: 1.0,
                altitude: 1,
                timestamp: new Date('1970-01-01T00:00:01Z'),
              },

              {
                position_long: 1.0,
                altitude: 1,
                timestamp: new Date('1970-01-01T00:00:02Z'),
              },

              {
                position_lat: 1.0,
                altitude: 1,
                timestamp: new Date('1970-01-01T00:00:03Z'),
              },

              {
                altitude: 1,
                timestamp: new Date('1970-01-01T00:00:04Z'),
              },
            ],
          },

          other: {},
        }),
      ).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              1,
              1,
              1,
              1,
            ],
          ],
          "type": "LineString",
        }
      `);
    });

    it('filters out altitude if no coordinates have one', () => {
      const service = new ActivityService();
      expect(
        service.suuntoFitToGeoJSON({
          activity: {
            records: [
              {
                position_long: 1.0,
                position_lat: 1.0,
                timestamp: new Date('1970-01-01T00:00:01Z'),
              },

              {
                position_long: 1.0,
                position_lat: 1.0,
                timestamp: new Date('1970-01-01T00:00:02Z'),
              },

              {
                position_long: 1.0,
                position_lat: 1.0,
                timestamp: new Date('1970-01-01T00:00:03Z'),
              },
            ],
          },

          other: {},
        }),
      ).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              1,
              1,
              0,
            ],
            [
              1,
              1,
              0,
            ],
            [
              1,
              1,
              0,
            ],
          ],
          "type": "LineString",
        }
      `);
    });

    it(`replaces out first point's altitude with second point's one if it has none`, () => {
      const service = new ActivityService();
      expect(
        service.suuntoFitToGeoJSON({
          activity: {
            records: [
              {
                position_long: 1.0,
                position_lat: 1.0,
                timestamp: new Date('1970-01-01T00:00:01Z'),
              },

              {
                position_long: 1.0,
                position_lat: 1.0,
                altitude: 2,
                timestamp: new Date('1970-01-01T00:00:02Z'),
              },

              {
                position_long: 1.0,
                position_lat: 1.0,
                altitude: 3,
                timestamp: new Date('1970-01-01T00:00:03Z'),
              },
            ],
          },

          other: {},
        }),
      ).toMatchInlineSnapshot(`
        {
          "coordinates": [
            [
              1,
              1,
              2,
              1,
            ],
            [
              1,
              1,
              2,
              2,
            ],
            [
              1,
              1,
              3,
              3,
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
        service.stravaStreamSetToGeoJSON(activity, [
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
        service.stravaStreamSetToGeoJSON(activity, [
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
        service.stravaStreamSetToGeoJSON(activity, [
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
        service.stravaStreamSetToGeoJSON(activity, [
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
        service.stravaStreamSetToGeoJSON(activity, [
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
        service.stravaStreamSetToGeoJSON(activity, [
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
        service.stravaStreamSetToGeoJSON(activity, [
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
        service.stravaStreamSetToGeoJSON(activity, [
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
