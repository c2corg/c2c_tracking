import { z } from 'zod';

export const StravaInfo = z.object({
  id: z.number().int().positive(),
  accessToken: z.string().min(10).max(5000),
  expiresAt: z.number().int().positive(),
  refreshToken: z.string().min(10).max(5000),
});
export type StravaInfo = z.infer<typeof StravaInfo>;

export const SuuntoInfo = z.object({
  username: z.string().min(1),
  accessToken: z.string().min(10).max(5000),
  expiresAt: z.number().int().positive(),
  refreshToken: z.string().min(10).max(5000),
});
export type SuuntoInfo = z.infer<typeof SuuntoInfo>;

export const GarminInfo = z.object({
  token: z.string().min(10).max(5000),
  tokenSecret: z.string().min(10).max(5000),
});
export type GarminInfo = z.infer<typeof GarminInfo>;

export const DecathlonInfo = z.object({
  id: z.string().min(1),
  accessToken: z.string().min(10).max(5000),
  expiresAt: z.number().int().positive(),
  refreshToken: z.string().min(10).max(5000),
  webhookId: z.string(),
});
export type DecathlonInfo = z.infer<typeof DecathlonInfo>;

export const User = z.object({
  c2cId: z.number().int().positive(),
  strava: StravaInfo.optional(),
  suunto: SuuntoInfo.optional(),
  garmin: GarminInfo.optional(),
  decathlon: DecathlonInfo.optional(),
});
export type User = z.infer<typeof User>;
