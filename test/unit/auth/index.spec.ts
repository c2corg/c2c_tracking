import { createMockContext } from '@shopify/jest-koa-mocks';
import { createRequest } from 'node-mocks-http';

import { c2cJwtExtractor, ensureAuthenticated, ensureUserFromParamsMatchesAuthUser, passport } from '../../../src/auth';
import { AuthenticatedUserStrategy } from '../../utils';

describe('c2cJwtExtractor', () => {
  test('retrieves token from header', () => {
    const req = createRequest({
      headers: {
        authorization: 'JWT token="a-nice-jwt-token"',
      },
    });
    expect(c2cJwtExtractor(req)).toBe('a-nice-jwt-token');
  });

  test('ignores invalid auth header', () => {
    const req = createRequest({
      headers: {
        authorization: 'Bearer a-nice-jwt-token"',
      },
    });
    expect(c2cJwtExtractor(req)).toBeNull();
  });
});

describe('ensureAuthenticated', () => {
  it('should allow authenticated user', async () => {
    passport.use('jwt', AuthenticatedUserStrategy(123));
    const ctx = createMockContext();
    await ensureAuthenticated(ctx, async () => undefined);
    expect(ctx.state).toMatchObject({ user: { id: 123 } });
  });

  it('should disallow un-authenticated user', async () => {
    passport.use('jwt', AuthenticatedUserStrategy());
    const ctx = createMockContext();
    await ensureAuthenticated(ctx, async () => undefined);
    expect(ctx.state).not.toHaveProperty('user');
  });
});

describe('ensureUserFromParamsMatchesAuthUser', () => {
  it('should allow matching user', async () => {
    const ctx = createMockContext({
      state: { user: { id: 123 } },
      customProperties: {
        params: { userId: '123' },
      },
    });
    await ensureUserFromParamsMatchesAuthUser(ctx, async () => undefined);
    expect(ctx.status).not.toBe(403);
  });

  it('should reject not matching user', async () => {
    const ctx = createMockContext({
      state: { user: { id: 456 } },
      customProperties: {
        params: { userId: '123' },
      },
    });
    await ensureUserFromParamsMatchesAuthUser(ctx, async () => undefined);
    expect(ctx.status).toBe(403);
  });

  it('should reject un-authenticated user', async () => {
    const ctx = createMockContext({
      state: {},
      customProperties: {
        params: { userId: '123' },
      },
    });
    await ensureUserFromParamsMatchesAuthUser(ctx, async () => undefined);
    expect(ctx.status).toBe(403);
  });
});
