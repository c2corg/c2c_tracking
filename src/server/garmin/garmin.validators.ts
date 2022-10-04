import { z } from 'zod';

import type { ValidationSchema } from '../validator';

export const exchangeToken: ValidationSchema = {
  query: z
    .object({
      oauth_token: z.string().min(10).max(50),
      oauth_verifier: z.string().min(4).max(50),
    })
    .required(),
};

export const activityWebhook: ValidationSchema = {
  body: z
    .object({
      activityDetails: z.array(
        z.object({
          userId: z.string(),
          userAccessToken: z.string(),
          activityId: z.number().int().positive(),
          summary: z.object({
            activityType: z.string().min(1).max(50),
            startTimeInSeconds: z.number().int().positive(),
          }),
          samples: z.array(
            z.object({
              startTimeInSeconds: z.number().int().positive().optional(),
              latitudeInDegree: z.number().optional(),
              longitudeInDegree: z.number().optional(),
              elevationInMeters: z.number().optional(),
            }),
          ),
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
          userAccessToken: z.string().min(10).max(5000),
        }),
      ),
    })
    .required(),
};
