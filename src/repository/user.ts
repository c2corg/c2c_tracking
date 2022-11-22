import { z } from 'zod';

export const StravaInfo = z.object({
  id: z.number().int().positive(),
  accessToken: z.string().min(10).max(5000).optional(),
  expiresAt: z.number().int().positive().optional(),
  refreshToken: z.string().min(10).max(5000).optional(),
});
export type StravaInfo = z.infer<typeof StravaInfo>;

export const SuuntoInfo = z.object({
  username: z.string().min(1),
  accessToken: z.string().min(10).max(5000).optional(),
  expiresAt: z.number().int().positive().optional(),
  refreshToken: z.string().min(10).max(5000).optional(),
});
export type SuuntoInfo = z.infer<typeof SuuntoInfo>;

export const GarminInfo = z.object({
  token: z.string().min(10).max(5000),
  tokenSecret: z.string().min(10).max(5000),
});
export type GarminInfo = z.infer<typeof GarminInfo>;

export const DecathlonInfo = z.object({
  id: z.string().min(1),
  accessToken: z.string().min(10).max(5000).optional(),
  expiresAt: z.number().int().positive().optional(),
  refreshToken: z.string().min(10).max(5000).optional(),
  webhookId: z.string(),
});
export type DecathlonInfo = z.infer<typeof DecathlonInfo>;

export const PolarInfo = z.object({
  id: z.number().int().positive(),
  token: z.string().min(10).max(50),
});
export type PolarInfo = z.infer<typeof PolarInfo>;

export const User = z.object({
  c2cId: z.number().int().positive(),
  strava: StravaInfo.optional(),
  suunto: SuuntoInfo.optional(),
  garmin: GarminInfo.optional(),
  decathlon: DecathlonInfo.optional(),
  polar: PolarInfo.optional(),
});
export type User = z.infer<typeof User>;
