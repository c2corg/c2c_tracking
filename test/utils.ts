import { EventEmitter } from 'node:events';

import type { Request, RequestHandler, Response } from 'express';
import { sign } from 'jsonwebtoken';
import {
  createRequest,
  createResponse,
  type MockRequest,
  type MockResponse,
  type RequestOptions,
} from 'node-mocks-http';
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

export type MiddlewareResult = {
  req: MockRequest<Request>;
  res: MockResponse<Response>;
  // whether the middleware passed the request on (`next`), and with which error
  next: boolean;
  error?: unknown;
};

// Runs a middleware on a mocked request, until it calls `next` or ends the response
export const runMiddleware = (handler: RequestHandler, options: RequestOptions = {}): Promise<MiddlewareResult> =>
  new Promise((resolve) => {
    const req = createRequest<Request>(options);
    const res = createResponse<Response>({ eventEmitter: EventEmitter });
    res.on('end', () => resolve({ req, res, next: false }));
    void handler(req, res, (error?: unknown) => resolve({ req, res, next: true, error }));
  });
