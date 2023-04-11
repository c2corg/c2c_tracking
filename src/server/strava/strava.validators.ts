import { z } from 'zod';

import type { ValidationSchema } from '../validator.js';

import { WebhookEvent } from './strava.api.js';

export const exchangeToken: ValidationSchema = {
  query: z
    .object({
      code: z.string().min(10).max(50),
      // eslint-disable-next-line security/detect-unsafe-regex
      scope: z.string().regex(/(?:[\w:]{1,30},){0,4}(?:[\w:]{1,30})/),
      state: z.string().max(100).optional(),
    })
    .or(
      z.object({
        error: z.string().min(1).max(100),
      }),
    ),
};

export const webhookSubscription: ValidationSchema = {
  query: z.object({
    'hub.mode': z.literal('subscribe'),
    'hub.challenge': z.string().min(1).max(255),
    'hub.verify_token': z.string().min(1).max(255),
  }),
};

export const webhook: ValidationSchema = {
  body: WebhookEvent,
};
