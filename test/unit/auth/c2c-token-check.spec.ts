import axios from 'axios';

import { TokenChecker } from '../../../src/auth/c2c-token-check';
import log from '../../../src/helpers/logger';

jest.mock('axios');

const answer = (status: number, data: unknown = {}): void => {
  jest.mocked(axios).get.mockResolvedValueOnce({ status, data });
};

describe('TokenChecker', () => {
  let now = 0;
  const checker = (): TokenChecker => new TokenChecker('https://api.example.org/', 60_000, () => now);

  beforeEach(() => {
    now = 1_000_000;
    jest.clearAllMocks();
    jest.mocked(axios).get.mockReset();
    jest.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  it('asks the API with the token', async () => {
    answer(200, { user: 123, expire: 1 });
    expect(await checker().isValid('a.b.c', 123)).toBe(true);
    expect(axios.get).toHaveBeenCalledWith('https://api.example.org/users/token', {
      headers: { Authorization: 'JWT token="a.b.c"' },
      timeout: 5_000,
      validateStatus: expect.any(Function) as unknown,
    });
  });

  it('refuses a token of another user', async () => {
    answer(200, { user: 456 });
    expect(await checker().isValid('a.b.c', 123)).toBe(false);
  });

  it.each([401, 403])('refuses a token the API answers %p to', async (status) => {
    answer(status);
    expect(await checker().isValid('a.b.c', 123)).toBe(false);
  });

  it('caches the answer for the TTL', async () => {
    const tokens = checker();
    answer(200, { user: 123 });
    expect(await tokens.isValid('a.b.c', 123)).toBe(true);
    now += 59_000;
    expect(await tokens.isValid('a.b.c', 123)).toBe(true);
    expect(axios.get).toHaveBeenCalledTimes(1);

    now += 2_000;
    answer(401);
    expect(await tokens.isValid('a.b.c', 123)).toBe(false);
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a 5xx', (): void => answer(502)],
    ['a network error', (): void => void jest.mocked(axios).get.mockRejectedValueOnce(new Error('ECONNREFUSED'))],
  ])('refuses without caching on %s', async (_, fail) => {
    const tokens = checker();
    fail();
    expect(await tokens.isValid('a.b.c', 123)).toBe(false);
    answer(200, { user: 123 });
    expect(await tokens.isValid('a.b.c', 123)).toBe(true);
    expect(log.warn).toHaveBeenCalledTimes(1);
  });
});
