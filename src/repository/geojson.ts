import { z } from 'zod';

export const LineString = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.array(z.number())),
});

export type LineString = z.infer<typeof LineString>;
