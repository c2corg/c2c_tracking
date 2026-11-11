import { describe, expect, it } from 'vitest';

import { isExcludedActivityType } from '../../src/excluded-activity-types.ts';

describe('isExcludedActivityType', () => {
  it.each([
    ['strava', 'Sail'],
    ['strava', 'VirtualRide'],
    ['suunto', 'Windsurfing'],
    ['coros', 'Shore Fishing'],
    ['polar', 'WATERSPORTS_SAILING'],
    ['garmin', 'SAILING_V2'],
    ['decathlon', 'Dinghy sailing'],
    ['decathlon', 'Golf'],
  ] as const)('excludes %s %s', (vendor, type) => {
    expect(isExcludedActivityType(vendor, type)).toBe(true);
  });

  it.each([
    ['strava', 'BackcountrySki'],
    ['strava', 'Ride'],
    ['strava', 'Unknown'],
    ['suunto', 'SkiTouring'],
    ['coros', 'Multi-Pitch'],
    ['coros', 'Pilot'],
    ['polar', 'DOWNHILL_SKIING'],
    ['garmin', 'RESORT_SKIING_SNOWBOARDING_WS'],
    ['garmin', 'UNKNOWN'],
    ['decathlon', 'Paragliding'],
    ['decathlon', 'Cani-hiking'],
  ] as const)('keeps %s %s', (vendor, type) => {
    expect(isExcludedActivityType(vendor, type)).toBe(false);
  });

  it('keeps an undefined type', () => {
    expect(isExcludedActivityType('coros', undefined)).toBe(false);
  });

  it('uses the vendor own types', () => {
    // Sail is Strava's, SAILING is Garmin's
    expect(isExcludedActivityType('garmin', 'Sail')).toBe(false);
  });
});
