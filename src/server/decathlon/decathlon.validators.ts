import { z } from 'zod';

import type { ValidationSchema } from '../validator.js';

import { WebhookEvent } from './decathlon.api';

export const exchangeToken: ValidationSchema = {
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
