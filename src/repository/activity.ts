import isISO8601 from 'validator/lib/isISO8601';
import { z } from 'zod';

import { LineString } from './geojson';

export const Vendor = z.enum(['strava', 'suunto', 'garmin', 'decathlon']);
export type Vendor = z.infer<typeof Vendor>;

export const Activity = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  vendor: Vendor,
  vendorId: z.string().min(1),
  date: z.string().refine(isISO8601),
  name: z.string().min(1).optional(),
  type: z.string().min(1),
  length: z.number().nonnegative().optional(),
  heightDiffUp: z.number().nonnegative().optional(),
  duration: z.number().int().nonnegative().optional(),
  geojson: LineString.optional(),
});

export type Activity = z.infer<typeof Activity>;
