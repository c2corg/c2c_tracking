import dayjs from 'dayjs';

import { AppError } from '../../errors';
import type { FitObj } from '../../helpers/fit/fit-parser';
import type { Activity } from '../../repository/activity';
import type { LineString } from '../../repository/geojson';
import type { AltitudeStream, DistanceStream, LatLngStream, StreamSet, TimeStream } from '../strava/strava.api';

export class ActivityService {
  suuntoFitToGeoJSON(fit: FitObj): LineString {
    if (!fit.activity?.['records']) {
      throw new AppError(501, 'Available data cannot be converted to a valid geometry');
    }

    let coordinates = fit.activity.records
      .map((record) => [
        record['position_long'] as number,
        record['position_lat'] as number,
        (record['altitude'] as number) || 0,
        dayjs(record['timestamp'] as Date).unix(),
      ])
      .filter(([lng, lat]) => !!lng && !!lat);

    if (coordinates.every(([_lng, _lat, alt]) => !alt)) {
      coordinates = coordinates.map((coordinate) => [coordinate[0]!, coordinate[1]!, coordinate[2]!]); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    }

    // Often, the first point has no altitude, but the next one has
    if (coordinates.length > 2) {
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      const [first, second, ...other] = coordinates;
      if (first![2] === 0 && second![2] !== 0) {
        first![2] = second![2]!;
        coordinates = [first!, second!, ...other];
      }
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
    }

    return {
      type: 'LineString',
      coordinates,
    };
  }

  stravaStreamSetToGeoJSON(activity: Activity, stream: StreamSet): LineString {
    const distanceStream: DistanceStream | undefined = stream.find(ActivityService.isDistanceStream);
    const timeStream: TimeStream | undefined = stream.find(ActivityService.isTimeStream);
    const latlngStream: LatLngStream | undefined = stream.find(ActivityService.isLatLngStream);
    const altStream: AltitudeStream | undefined = stream.find(ActivityService.isAltitudeStream);

    if (!distanceStream || !latlngStream) {
      throw new AppError(501, 'Available data cannot be converted to a valid geometry');
    }
    if (
      stream.some(({ series_type }) => series_type !== 'distance') ||
      new Set(stream.map(({ original_size }) => original_size)).size > 1
    ) {
      // for now, we cannot handle streams where not everything is synchronized with the distance stream
      throw new AppError(501, 'Available data cannot be converted to a valid geometry');
    }

    const layout = !!altStream
      ? !!timeStream && activity.date
        ? 'XYZM'
        : 'XYZ'
      : !!timeStream && activity.date
      ? 'XYM'
      : 'XY';
    const startDate = activity.date ? dayjs(activity.date).unix() : 0;
    const coordinates: GeoJSON.Position[] = [];
    for (let i = 0; i < distanceStream.original_size; i++) {
      // eslint-disable-next-line security/detect-object-injection, @typescript-eslint/no-non-null-assertion
      const coordinate: number[] = latlngStream.data[i]!.reverse();
      if (layout.includes('Z')) {
        // eslint-disable-next-line security/detect-object-injection, @typescript-eslint/no-non-null-assertion
        coordinate.push(altStream!.data[i]!);
      }
      if (layout.includes('M')) {
        // eslint-disable-next-line security/detect-object-injection, @typescript-eslint/no-non-null-assertion
        coordinate.push(startDate + timeStream!.data[i]!);
      }
      coordinates.push(coordinate);
    }
    return {
      type: 'LineString',
      coordinates,
    };
  }

  private static isDistanceStream = (
    stream: DistanceStream | TimeStream | LatLngStream | AltitudeStream,
  ): stream is DistanceStream => stream.type === 'distance';

  private static isTimeStream = (
    stream: DistanceStream | TimeStream | LatLngStream | AltitudeStream,
  ): stream is TimeStream => stream.type === 'time';

  private static isLatLngStream = (
    stream: DistanceStream | TimeStream | LatLngStream | AltitudeStream,
  ): stream is LatLngStream => stream.type === 'latlng';

  private static isAltitudeStream = (
    stream: DistanceStream | TimeStream | LatLngStream | AltitudeStream,
  ): stream is AltitudeStream => stream.type === 'altitude';
}

export const activityService = new ActivityService();