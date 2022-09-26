import type { Request } from 'express';
import { Strategy as CustomStrategy, VerifiedCallback } from 'passport-custom';

export const AuthenticatedUserStrategy = (userId?: number): CustomStrategy =>
  new CustomStrategy((_req: Request, callback: VerifiedCallback) => {
    if (userId) {
      callback(null, { id: userId });
    } else {
      callback(null, false);
    }
  });
