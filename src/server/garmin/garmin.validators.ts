import { z } from 'zod';

import type { ValidationSchema } from '../validator';

import { GarminActivity } from './garmin.api';

// OAuth 2 redirection: `code` and `state` on success, `error` if the user denied access
export const exchangeToken: ValidationSchema = {
  query: z.object({
    code: z.string().min(1).max(5000).optional(),
    state: z.string().min(10).max(128).optional(),
    error: z.string().max(500).optional(),
  }),
};

// `userAccessToken` (OAuth 1) is no longer sent once Garmin has switched the application to OAuth 2
export const activityWebhook: ValidationSchema = {
  body: z
    .object({
      activityDetails: z.array(
        GarminActivity.extend({
          userId: z.string(),
          userAccessToken: z.string().optional(),
        }),
      ),
    })
    .required(),
};

export const deauthorizeWebhook: ValidationSchema = {
  body: z
    .object({
      deregistrations: z.array(
        z.object({
          userId: z.string().min(1).max(50),
          userAccessToken: z.string().min(10).max(5000).optional(),
        }),
      ),
    })
    .required(),
};
