import type { Except, SetOptional, SetRequired } from 'type-fest';
import validator from 'validator';
import { z } from 'zod';

import { LineString } from './geojson.js';

export const Vendor = z.enum(['strava', 'suunto', 'garmin', 'decathlon', 'polar', 'coros']);
export type Vendor = z.infer<typeof Vendor>;

export const Activity = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  vendor: Vendor,
  vendorId: z.string().min(1),
  date: z.string().refine(validator.isISO8601, {
    message: 'String must be an ISO-8601 date',
  }),
  name: z.string().min(1).optional(),
  type: z.string().min(1),
  length: z.number().nonnegative().optional(),
  heightDiffUp: z.number().nonnegative().optional(),
  duration: z.number().int().nonnegative().optional(),
  geojson: LineString.optional(),
  miniature: z.string().length(28).optional(),
});

export type Activity = z.infer<typeof Activity>;

export type NewActivity = Except<Activity, 'id' | 'userId'>;

export type NewActivityWithGeometry = SetRequired<NewActivity, 'geojson'>;

export const hasGeometry = (activity: NewActivity): activity is NewActivityWithGeometry => !!activity.geojson;

export type UpdateActivity = SetOptional<
  Pick<Activity, 'vendor' | 'vendorId' | 'date' | 'type' | 'name' | 'length' | 'heightDiffUp' | 'duration' | 'geojson'>,
  'date' | 'type' | 'name' | 'length' | 'heightDiffUp' | 'duration' | 'geojson'
>;
