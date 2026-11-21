import type { Vendor } from '../repository/activity.ts';

import log from './logger.ts';

/**
 * Log the vendor's raw activity type that is not in the known list, and return the fallback.
 */
export const unknownActivityType = (vendor: Vendor, value: unknown, fallback = 'Unknown'): string => {
  // vendors add activity types over time: the raw value tells which one to add to the list
  log.warn({ vendor, activityType: value }, `Unknown ${vendor} activity type`);
  return fallback;
};

/**
 * The vendor's activity type when it is in the known list, else the fallback.
 */
export const knownActivityType = (
  vendor: Vendor,
  value: string | undefined,
  known: ReadonlySet<string>,
  fallback = 'Unknown',
): string => (value !== undefined && known.has(value) ? value : unknownActivityType(vendor, value, fallback));
