import type { RequestHandler } from 'express';
import { z } from 'zod';

import { type ValidationSchema, userIdParams } from '../validator.ts';

import { WebhookEvent } from './strava.api.ts';

// Integers beyond Number.MAX_SAFE_INTEGER are kept as their source text, so that 64-bit IDs are not rounded
function keepUnsafeIntegersAsString(_key: string, value: unknown, context?: { source?: string }): unknown {
  return typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value) && context?.source
    ? context.source
    : value;
}

// Webhook events carry object_id and owner_id as bare JSON numbers: parse the raw body again to keep them exact
export const parseWebhookBody: RequestHandler = (req, _res, next) => {
  if (req.rawBody === undefined) {
    next();
    return;
  }
  try {
    req.body = JSON.parse(req.rawBody, keepUnsafeIntegersAsString) as unknown;
    next();
  } catch (error: unknown) {
    next(error);
  }
};

export const exchangeToken: ValidationSchema = {
  params: userIdParams,
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

export const deauthorize: ValidationSchema = { params: userIdParams };
