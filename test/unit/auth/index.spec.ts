import { createMockContext } from '@shopify/jest-koa-mocks';

import { ensureAuthenticated, ensureUserFromParamsMatchesAuthUser, passport } from '../../../src/auth/index.js';
import log from '../../../src/helpers/logger.js';
import { AuthenticatedUserStrategy } from '../../utils.js';

describe('ensureAuthenticated', () => {
  beforeEach(() => {
    jest.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    jest.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  it('allows authenticated user', async () => {
    passport.use('jwt', AuthenticatedUserStrategy(123));
    const ctx = createMockContext();
    await ensureAuthenticated(ctx, () => Promise.resolve(undefined));
    expect(ctx.state).toMatchObject({ user: { id: 123 } });
  });

  it('disallows un-authenticated user', async () => {
    passport.use('jwt', AuthenticatedUserStrategy());
    const ctx = createMockContext();
    await ensureAuthenticated(ctx, () => Promise.resolve(undefined));
    expect(ctx.state).not.toHaveProperty('user');
  });
});

describe('ensureUserFromParamsMatchesAuthUser', () => {
  it('allows matching user', async () => {
    const ctx = createMockContext({
      state: { user: { id: 123 } },
      customProperties: {
        params: { userId: '123' },
      },
    });
    await ensureUserFromParamsMatchesAuthUser(ctx, () => Promise.resolve(undefined));
    expect(ctx.status).not.toBe(403);
  });

  it('rejects not matching user', async () => {
    const ctx = createMockContext({
      state: { user: { id: 456 } },
      customProperties: {
        params: { userId: '123' },
      },
      throw: jest.fn(),
    });
    await ensureUserFromParamsMatchesAuthUser(ctx, () => Promise.resolve(undefined));
    expect(ctx.throw).toHaveBeenCalledTimes(1);
    expect(ctx.throw).toHaveBeenCalledWith(403);
  });

  it('rejects un-authenticated user', async () => {
    const ctx = createMockContext({
      state: {},
      customProperties: {
        params: { userId: '123' },
      },
      throw: jest.fn(),
    });
    await ensureUserFromParamsMatchesAuthUser(ctx, () => Promise.resolve(undefined));
    expect(ctx.throw).toHaveBeenCalledTimes(1);
    expect(ctx.throw).toHaveBeenCalledWith(403);
  });
});
