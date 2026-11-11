import { describe, expect, it } from 'vitest';

import { toC2cActivities } from '../../src/c2c-activities.ts';

describe('toC2cActivities', () => {
  it.each([
    ['strava', 'BackcountrySki', 'skitouring'],
    ['strava', 'EMountainBikeRide', 'mountain_biking'],
    ['suunto', 'Splitboarding', 'skitouring'],
    ['coros', 'Bouldering', 'rock_climbing'],
    ['polar', 'SNOWSHOE_TREKKING', 'snowshoeing'],
    ['garmin', 'HIKING', 'hiking'],
    ['decathlon', 'Glacier hiking', 'snow_ice_mixed'],
    ['decathlon', 'Via ferrata', 'via_ferrata'],
    ['decathlon', 'Mountain biking ', 'mountain_biking'],
  ] as const)('maps %s %s to %s', (vendor, type, activity) => {
    expect(toC2cActivities(vendor, type)).toEqual([activity]);
  });

  it.each([
    ['strava', 'RockClimbing'],
    ['strava', 'TrailRun'],
    ['strava', 'Unknown'],
    ['suunto', 'Mountaineering'],
    ['coros', 'Mountain Climb'],
    ['coros', 'Multi-Pitch'],
    ['coros', 'Pilot'],
    ['garmin', 'HANG_GLIDING'],
    ['garmin', 'RESORT_SKIING_SNOWBOARDING_WS'],
    ['decathlon', 'Mountaineering'],
    ['decathlon', 'Mixed climbing'],
  ] as const)('maps %s %s to none', (vendor, type) => {
    expect(toC2cActivities(vendor, type)).toEqual([]);
  });

  it('uses the vendor own types', () => {
    // Hike is Strava's, HIKING is Garmin's
    expect(toC2cActivities('garmin', 'Hike')).toEqual([]);
  });
});
