import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fitToGeoJSON } from '../../../src/helpers/utils.ts';

const fixture = (name: string): ArrayBuffer =>
  new Uint8Array(readFileSync(resolve(import.meta.dirname, '../../resources', name))).buffer;

describe('fitToGeoJSON', () => {
  it('converts the records of a FIT file to a line string of [longitude, latitude, altitude, timestamp]', () => {
    expect(fitToGeoJSON(fixture('mini.fit'))).toEqual({
      type: 'LineString',
      coordinates: [[expect.closeTo(5.825548, 6), expect.closeTo(44.972592, 6), 1503, 1670140122], expect.any(Array)],
    });
  });

  it('gives nothing for data that is not a FIT file', () => {
    expect(fitToGeoJSON(new TextEncoder().encode('not a FIT file').buffer)).toBeUndefined();
    expect(fitToGeoJSON(new ArrayBuffer(0))).toBeUndefined();
  });
});
