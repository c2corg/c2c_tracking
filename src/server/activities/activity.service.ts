import { extractGeometry } from '@c2corg/fit-parser-extract-geometry';
import dayjs from 'dayjs';

import { AppError, ExternalApiError, NotFoundError } from '../../errors';
import { Lang, translations } from '../../helpers/i18n';
import type { Activity } from '../../repository/activity';
import { activityRepository } from '../../repository/activity.repository';
import type { LineString } from '../../repository/geojson';
import { userService } from '../../user.service';
import { decathlonService } from '../decathlon/decathlon.service';
import type { AltitudeStream, DistanceStream, LatLngStream, StreamSet, TimeStream } from '../strava/strava.api';
import { stravaService } from '../strava/strava.service';
import { suuntoService } from '../suunto/suunto.service';

export class ActivityService {
  public async getActivities(
    userId: number,
    lang?: Lang,
  ): Promise<(Omit<Activity, 'geojson' | 'type'> & { type: Partial<Record<Lang, string>> })[]> {
    const langs: Lang[] = lang ? [lang] : Lang.options;
    return (await userService.getActivities(userId)).map(({ geojson, type, ...keep }) => {
      const translated = langs.reduce(
        (acc, l) => ({
          ...acc,
          [l]:
            // eslint-disable-next-line security/detect-object-injection
            translations[l][this.i18nKey(type)]?.string ??
            translations['en'][this.i18nKey(type)]?.string ??
            // eslint-disable-next-line security/detect-object-injection
            translations[l]['unknown']?.string ??
            'Unknown',
        }),
        {},
      );
      return {
        ...keep,
        type: translated,
      };
    });
  }

  private i18nKey(key: string): string {
    return key.replaceAll(/[:_\-, ]/g, '').toLowerCase();
  }

  public async getActivityGeometry(userId: number, activityId: number): Promise<LineString | undefined> {
    // retrieve activity id and vendor
    const activity = await userService.getActivity(userId, activityId);
    if (!activity) {
      throw new NotFoundError();
    }

    if (activity.geojson) {
      return activity.geojson;
    }

    switch (activity.vendor) {
      case 'strava': {
        const token = await stravaService.getToken(userId);
        if (!token) {
          throw new ExternalApiError('Unable to acquire valid token');
        }

        let geojson: LineString | undefined;
        try {
          const stream = await stravaService.getActivityStream(token, activity.vendorId);
          geojson = this.stravaStreamSetToGeoJSON(activity, stream);
        } catch (error: unknown) {
          throw new NotFoundError('Unable to retrieve geometry', error instanceof Error ? error : undefined);
        }
        this.saveGeometry(activity, geojson);
        return geojson;
      }
      case 'suunto': {
        const token = await suuntoService.getToken(userId);
        if (!token) {
          throw new ExternalApiError('Unable to acquire valid token');
        }
        let fit: ArrayBuffer | undefined;
        try {
          fit = await suuntoService.getFIT(token, activity.vendorId);
        } catch (error: unknown) {
          throw new NotFoundError('Unable to retrieve geometry', error instanceof Error ? error : undefined);
        }
        let geojson: LineString | undefined;
        try {
          geojson = this.fitToGeoJSON(fit);
        } catch (error: unknown) {
          throw new NotFoundError(
            'Unable to convert Suunto FIT file to geometry',
            error instanceof Error ? error : undefined,
          );
        }
        this.saveGeometry(activity, geojson);
        return geojson;
      }
      case 'decathlon': {
        const token = await decathlonService.getToken(userId);
        if (!token) {
          throw new ExternalApiError('Unable to acquire valid token');
        }

        let geojson: LineString | undefined;
        try {
          geojson = await decathlonService.getActivityGeometry(token, activity.vendorId);
        } catch (error: unknown) {
          throw new NotFoundError('Unable to retrieve geometry', error instanceof Error ? error : undefined);
        }
        if (!geojson) {
          throw new NotFoundError('Unable to retrieve geometry');
        }
        this.saveGeometry(activity, geojson);
        return geojson;
      }
      case 'garmin':
        // should contain data in db and be returned above
        throw new AppError(500, `Unable to acquire Garmin geometry`);
    }
  }

  private fitToGeoJSON(fit: ArrayBuffer): LineString {
    const coordinates = extractGeometry(new Uint8Array(fit));
    if (!coordinates.length) {
      throw new NotFoundError('Available data cannot be converted to a valid geometry');
    }
    return { coordinates, type: 'LineString' };
  }

  private stravaStreamSetToGeoJSON(activity: Activity, stream: StreamSet): LineString {
    const distanceStream: DistanceStream | undefined = stream.find(ActivityService.isDistanceStream);
    const timeStream: TimeStream | undefined = stream.find(ActivityService.isTimeStream);
    const latlngStream: LatLngStream | undefined = stream.find(ActivityService.isLatLngStream);
    const altStream: AltitudeStream | undefined = stream.find(ActivityService.isAltitudeStream);

    if (!distanceStream || !latlngStream) {
      throw new NotFoundError('Available data cannot be converted to a valid geometry');
    }
    if (
      stream.some(({ series_type }) => series_type !== 'distance') ||
      new Set(stream.map(({ original_size }) => original_size)).size > 1
    ) {
      // for now, we cannot handle streams where not everything is synchronized with the distance stream
      throw new NotFoundError('Available data cannot be converted to a valid geometry');
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

  private async saveGeometry(activity: Activity, geojson: LineString): Promise<void> {
    try {
      await activityRepository.update({ ...activity, geojson });
    } catch (error: unknown) {
      // an error should not prevent returning geojson to the request
    }
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
