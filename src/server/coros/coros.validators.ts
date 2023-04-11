import { z } from 'zod';

import type { ValidationSchema } from '../validator.js';

import { WebhookEvent } from './coros.api';

export const exchangeToken: ValidationSchema = {
  query: z.object({
    code: z.string().min(10).max(50).optional(), // only provided if user agreed
  }),
};

export const webhook: ValidationSchema = {
  body: WebhookEvent,
  headers: z.object({ client: z.string(), secret: z.string() }),
};
