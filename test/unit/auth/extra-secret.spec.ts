import { createMockContext } from '@shopify/jest-koa-mocks';
import { sign } from 'jsonwebtoken';

type Auth = typeof import('../../../src/auth');

const MAIN_SECRET = 'secret'; // JWT_SECRET_KEY of test/environment/env-vars.mjs
const EXTRA_SECRET = 'the-extra-secret';

// The configuration is read when the module is loaded: load it again for each environment
const loadAuth = (env: Record<string, string>): Auth => {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  try {
    let auth: Auth | undefined;
    jest.isolateModules(() => {
      auth = jest.requireActual<Auth>('../../../src/auth');
    });
    return auth!;
  } finally {
    process.env = previous;
  }
};

const authenticate = async (auth: Auth, secret: string, sub: number): Promise<unknown> => {
  const token = sign({}, secret, { expiresIn: '1m', subject: sub.toString() });
  const ctx = createMockContext({ headers: { authorization: `JWT token="${token}"` } });
  await auth.ensureAuthenticated(ctx, () => Promise.resolve(undefined));
  return ctx.state['user'] as unknown;
};

describe('JWT with an extra secret', () => {
  const withExtra = { JWT_SECRET_KEY_EXTRA: EXTRA_SECRET };

  it('accepts the main secret as is', async () => {
    const auth = loadAuth(withExtra);
    expect(await authenticate(auth, MAIN_SECRET, 123)).toEqual({ id: 123 });
  });

  it('accepts the extra secret, shifting the user id', async () => {
    const auth = loadAuth(withExtra);
    expect(await authenticate(auth, EXTRA_SECRET, 123)).toEqual({ id: 1_000_000_123 });
  });

  it('uses the configured offset', async () => {
    const auth = loadAuth({ ...withExtra, JWT_EXTRA_ID_OFFSET: '500000000' });
    expect(await authenticate(auth, EXTRA_SECRET, 123)).toEqual({ id: 500_000_123 });
  });

  it('refuses a user id of the extra API above the offset', async () => {
    const auth = loadAuth(withExtra);
    expect(await authenticate(auth, EXTRA_SECRET, 1_000_000_001)).toBeUndefined();
  });

  it('refuses any other secret', async () => {
    const auth = loadAuth(withExtra);
    expect(await authenticate(auth, 'another-secret', 123)).toBeUndefined();
  });

  it('refuses the extra secret when it is not configured', async () => {
    const auth = loadAuth({ JWT_SECRET_KEY_EXTRA: '' });
    expect(await authenticate(auth, EXTRA_SECRET, 123)).toBeUndefined();
  });

  it('refuses an extra secret equal to the main one', () => {
    expect(() => loadAuth({ JWT_SECRET_KEY_EXTRA: MAIN_SECRET })).toThrow(
      'JWT_SECRET_KEY_EXTRA must be different from JWT_SECRET_KEY',
    );
  });
});
