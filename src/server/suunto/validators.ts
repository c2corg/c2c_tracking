import { z } from 'zod';

import type { ValidationSchema } from '../validator';

export const exchangeToken: ValidationSchema = {
  query: z
    .object({
      code: z.string().min(5).max(50),
    })
    .or(z.object({ error: z.string().min(1).max(50), error_desscription: z.string().min(1).max(255) })),
};

export const webhook: ValidationSchema = {
  body: z.object({
    username: z.string().min(1).max(50),
    workoutid: z.string().min(1).max(50),
  }),
  headers: z.object({
    authorization: z.string(),
  }),
};
