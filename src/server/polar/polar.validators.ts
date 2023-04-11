import { z } from 'zod';

import type { ValidationSchema } from '../validator.js';

import { WebhookEvent } from './polar.api.js';

export const exchangeToken: ValidationSchema = {
  query: z
    .object({
      code: z.string().min(10).max(50),
      state: z.string().max(100).optional(),
    })
    .or(
      z.object({
        error: z.enum([
          'invalid_request',
          'unauthorized_client',
          'access_denied',
          'unsupported_response_type',
          'invalid_scope',
          'server_error',
          'temporarily_unavailable',
        ]),
      }),
    ),
};

export const webhook: ValidationSchema = {
  headers: z.object({
    'polar-webhook-signature': z.string().min(1).max(100).optional(),
  }),
  body: WebhookEvent,
};
