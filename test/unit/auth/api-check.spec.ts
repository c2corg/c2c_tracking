import { createMockContext } from '@shopify/jest-koa-mocks';
import axios from 'axios';
import { sign } from 'jsonwebtoken';

import log from '../../../src/helpers/logger';

jest.mock('axios');

type Auth = typeof import('../../../src/auth');

const SECRET = 'secret'; // JWT_SECRET_KEY of test/environment/env-vars.mjs

// The configuration is read when the module is loaded: load it again with the API to check the tokens
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

const authenticate = async (auth: Auth, sub: number): Promise<unknown> => {
  const token = sign({}, SECRET, { expiresIn: '1m', subject: sub.toString() });
  const ctx = createMockContext({ headers: { authorization: `JWT token="${token}"` } });
  await auth.ensureAuthenticated(ctx, () => Promise.resolve(undefined));
  return ctx.state['user'] as unknown;
};

describe('JWT checked by the API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  it('accepts a token the API confirms', async () => {
    jest.mocked(axios).get.mockResolvedValueOnce({ status: 200, data: { user: 123 } });
    const auth = loadAuth({ C2C_API_BASE_URL: 'https://api.example.org/' });
    expect(await authenticate(auth, 123)).toEqual({ id: 123 });
    expect(axios.get).toHaveBeenCalledWith('https://api.example.org/users/token', expect.anything());
  });

  it('refuses a validly signed token the API revoked', async () => {
    jest.mocked(axios).get.mockResolvedValueOnce({ status: 401, data: {} });
    const auth = loadAuth({ C2C_API_BASE_URL: 'https://api.example.org/' });
    expect(await authenticate(auth, 123)).toBeUndefined();
  });

  it('checks the signature only without an API', async () => {
    const auth = loadAuth({ C2C_API_BASE_URL: '' });
    expect(await authenticate(auth, 123)).toEqual({ id: 123 });
    expect(axios.get).not.toHaveBeenCalled();
  });
});
