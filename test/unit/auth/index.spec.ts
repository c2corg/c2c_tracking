import { createMockContext } from '@shopify/jest-koa-mocks';

import { ensureAuthenticated, ensureUserFromParamsMatchesAuthUser, passport } from '../../../src/auth';
import { ForbiddenError } from '../../../src/errors';
import { AuthenticatedUserStrategy } from '../../utils';

describe('ensureAuthenticated', () => {
  it('allows authenticated user', async () => {
    passport.use('jwt', AuthenticatedUserStrategy(123));
    const ctx = createMockContext();
    await ensureAuthenticated(ctx, async () => undefined);
    expect(ctx.state).toMatchObject({ user: { id: 123 } });
  });

  it('disallows un-authenticated user', async () => {
    passport.use('jwt', AuthenticatedUserStrategy());
    const ctx = createMockContext();
    await ensureAuthenticated(ctx, async () => undefined);
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
    await ensureUserFromParamsMatchesAuthUser(ctx, async () => undefined);
    expect(ctx.status).not.toBe(403);
  });

  it('rejects not matching user', async () => {
    const ctx = createMockContext({
      state: { user: { id: 456 } },
      customProperties: {
        params: { userId: '123' },
      },
    });
    await expect(ensureUserFromParamsMatchesAuthUser(ctx, async () => undefined)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('rejects un-authenticated user', async () => {
    const ctx = createMockContext({
      state: {},
      customProperties: {
        params: { userId: '123' },
      },
    });
    await expect(ensureUserFromParamsMatchesAuthUser(ctx, async () => undefined)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
