import { z } from 'zod';

import { type ValidationSchema, userIdParams } from '../validator.ts';

export const exchangeToken: ValidationSchema = {
  params: userIdParams,
  query: z
    .object({
      code: z.string().min(5).max(255),
    })
    .or(z.object({ error: z.string().min(1).max(50), error_description: z.string().min(1).max(255) })),
};

export const webhook: ValidationSchema = {
  // Note: application/x-www-form-urlencoded
  body: z.object({
    username: z.string().min(1).max(50),
    workoutid: z.string().min(1).max(50),
  }),
  headers: z.object({
    authorization: z.string(),
  }),
};

export const deauthorize: ValidationSchema = { params: userIdParams };
