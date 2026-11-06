import { z } from 'zod';

import { type ValidationSchema, userIdParams } from '../validator.ts';

import { WebhookEvent } from './coros.api.ts';

export const exchangeToken: ValidationSchema = {
  params: userIdParams,
  query: z.object({
    code: z.string().min(10).max(50).optional(), // only provided if user agreed
  }),
};

export const webhook: ValidationSchema = {
  body: WebhookEvent,
  headers: z.object({ client: z.string(), secret: z.string() }),
};

export const deauthorize: ValidationSchema = { params: userIdParams };
