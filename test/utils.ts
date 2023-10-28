import type { Request } from 'express';
import { sign } from 'jsonwebtoken';
import { Strategy as CustomStrategy, VerifiedCallback } from 'passport-custom';
import type { Test } from 'supertest';

export const AuthenticatedUserStrategy = (userId?: number): CustomStrategy =>
  new CustomStrategy((_req: Request, callback: VerifiedCallback) => {
    if (userId) {
      callback(null, { id: userId });
    } else {
      callback(null, false);
    }
  });

export const generateC2cValidToken = (id: number): string => {
  return sign({}, process.env['JWT_SECRET_KEY']!, { expiresIn: '1m', subject: id.toString() });
};

export const authenticated = (request: Test, c2cId: number): Test =>
  request.set('Authorization', `JWT token="${generateC2cValidToken(c2cId)}"`);
