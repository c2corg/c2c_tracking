import { describe, expect, it, vi } from 'vitest';

import { knownActivityType, unknownActivityType } from '../../../src/helpers/activity-type.ts';
import log from '../../../src/helpers/logger.ts';

describe('activity type', () => {
  describe('unknownActivityType', () => {
    it('logs the raw value and returns the fallback', () => {
      const warn = vi.spyOn(log, 'warn');

      expect(unknownActivityType('suunto', 121)).toBe('Unknown');
      expect(unknownActivityType('garmin', 'NEW_SPORT', 'UNKNOWN')).toBe('UNKNOWN');
      expect(warn).toHaveBeenCalledWith({ vendor: 'suunto', activityType: 121 }, 'Unknown suunto activity type');
      expect(warn).toHaveBeenCalledWith(
        { vendor: 'garmin', activityType: 'NEW_SPORT' },
        'Unknown garmin activity type',
      );
    });
  });

  describe('knownActivityType', () => {
    const known = new Set(['Run', 'Hike']);

    it('returns a known value', () => {
      const warn = vi.spyOn(log, 'warn');

      expect(knownActivityType('strava', 'Hike', known)).toBe('Hike');
      expect(warn).not.toHaveBeenCalled();
    });

    it('returns the fallback for an unknown or missing value', () => {
      const warn = vi.spyOn(log, 'warn');

      expect(knownActivityType('strava', 'Padel', known)).toBe('Unknown');
      expect(knownActivityType('polar', undefined, known, 'Other')).toBe('Other');
      expect(warn).toHaveBeenCalledTimes(2);
    });
  });
});
