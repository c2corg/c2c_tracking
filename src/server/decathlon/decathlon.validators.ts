import { z } from 'zod';

import { type ValidationSchema, userIdParams } from '../validator.ts';

import { WebhookEvent } from './decathlon.api.ts';

export const exchangeToken: ValidationSchema = {
  params: userIdParams,
  query: z
    .object({
      code: z.string().min(5).max(50),
      state: z.string().max(100),
    })
    .or(
      z.object({
        error: z.string().min(1).max(100),
        error_description: z.string().min(1).max(100).optional(),
        state: z.string().max(100),
      }),
    ),
};

export const webhook: ValidationSchema = { body: WebhookEvent };

export const deauthorize: ValidationSchema = { params: userIdParams };
