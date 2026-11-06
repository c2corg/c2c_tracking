import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Request } from 'express';
import { sign } from 'jsonwebtoken';
import Koa, { type Context } from 'koa';
import { createRequest, createResponse } from 'node-mocks-http';
import type { VerifiedCallback } from 'passport-custom';
import { Strategy as CustomStrategy } from 'passport-custom';
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

type MockContextOptions = {
  headers?: Record<string, string>;
  state?: Record<string, unknown>;
  customProperties?: Record<string, unknown>;
  throw?: (...args: never[]) => unknown;
};

// A real Koa context, on top of mocked Node request and response
export const createMockContext = (options: MockContextOptions = {}): Context => {
  const ctx = new Koa().createContext(
    createRequest({ headers: options.headers ?? {} }) as unknown as IncomingMessage,
    createResponse() as unknown as ServerResponse,
  );
  Object.assign(ctx.state, options.state);
  Object.assign(ctx, options.customProperties);
  if (options.throw) {
    ctx.throw = options.throw as Context['throw'];
  }
  return ctx;
};
