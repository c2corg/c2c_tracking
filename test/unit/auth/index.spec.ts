import type { RequestOptions } from 'node-mocks-http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureAuthenticated, ensureUserFromParamsMatchesAuthUser, passport } from '../../../src/auth/index.ts';
import log from '../../../src/helpers/logger.ts';
import { AuthenticatedUserStrategy, runMiddleware } from '../../utils.ts';

describe('ensureAuthenticated', () => {
  beforeEach(() => {
    vi.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    vi.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  it('allows authenticated user', async () => {
    passport.use('jwt', AuthenticatedUserStrategy(123));
    const { req, next } = await runMiddleware(ensureAuthenticated);
    expect(next).toBe(true);
    expect(req.user).toEqual({ id: 123 });
  });

  it('disallows un-authenticated user', async () => {
    passport.use('jwt', AuthenticatedUserStrategy());
    const { req, res, next } = await runMiddleware(ensureAuthenticated);
    expect(next).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(req.user).toBeUndefined();
  });
});

describe('ensureUserFromParamsMatchesAuthUser', () => {
  // node-mocks-http sets the other options (here the authenticated user) on the request
  const withUser = (user: { id: number } | undefined): RequestOptions => ({ params: { userId: '123' }, user });

  it('allows matching user', async () => {
    const { next, error } = await runMiddleware(ensureUserFromParamsMatchesAuthUser, withUser({ id: 123 }));
    expect(next).toBe(true);
    expect(error).toBeUndefined();
  });

  it('rejects not matching user', async () => {
    const { error } = await runMiddleware(ensureUserFromParamsMatchesAuthUser, withUser({ id: 456 }));
    expect(error).toMatchObject({ status: 403 });
  });

  it('rejects un-authenticated user', async () => {
    const { error } = await runMiddleware(ensureUserFromParamsMatchesAuthUser, withUser(undefined));
    expect(error).toMatchObject({ status: 403 });
  });
});
