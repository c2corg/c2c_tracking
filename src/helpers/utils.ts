import { extractGeometry } from '@c2corg/fit-parser-extract-geometry';
import aes from 'crypto-js/aes';
import encUtf8 from 'crypto-js/enc-utf8';
import { parse } from 'iso8601-duration';
import type { Except } from 'type-fest';

import config from '../config';
import type { LineString } from '../repository/geojson';

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Except<T, K>;

// allows typescript to infer non nullable
export const truthy = <T>(x: T): x is NonNullable<typeof x> => Boolean(x);

export const semverRegex =
  // eslint-disable-next-line security/detect-unsafe-regex
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export const isISO8601Duration = (duration: string | undefined): boolean => {
  if (!duration) {
    return false;
  }
  try {
    parse(duration);
    return true;
  } catch (error: unknown) {
    return false;
  }
};

export const fitToGeoJSON = (fit: ArrayBuffer): LineString | undefined => {
  try {
    const coordinates = extractGeometry(new Uint8Array(fit));
    if (!coordinates.length) {
      return undefined;
    }
    return { coordinates, type: 'LineString' };
  } catch {
    return undefined;
  }
};

export const encrypt = (token: string): string => aes.encrypt(token, config.get('db.crypto')).toString();

export const decrypt = (token: string): string => aes.decrypt(token, config.get('db.crypto')).toString(encUtf8);
