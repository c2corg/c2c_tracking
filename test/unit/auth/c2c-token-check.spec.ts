import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TokenChecker } from '../../../src/auth/c2c-token-check.ts';
import { http } from '../../../src/helpers/http.ts';
import log from '../../../src/helpers/logger.ts';

// the HTTP calls are mocked, not the errors
vi.mock('../../../src/helpers/http.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  http: { get: vi.fn(), post: vi.fn(), postForm: vi.fn(), delete: vi.fn() },
}));

const answer = (status: number, data: unknown = {}): void => {
  vi.mocked(http).get.mockResolvedValueOnce({ status, data });
};

describe('TokenChecker', () => {
  let now = 0;
  const checker = (): TokenChecker => new TokenChecker('https://api.example.org/', 60_000, () => now);

  beforeEach(() => {
    now = 1_000_000;
    vi.clearAllMocks();
    vi.mocked(http).get.mockReset();
    vi.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  it('asks the API with the token', async () => {
    answer(200, { user: 123, expire: 1 });
    expect(await checker().isValid('a.b.c', 123)).toBe(true);
    expect(http.get).toHaveBeenCalledWith('https://api.example.org/users/token', {
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
    expect(http.get).toHaveBeenCalledTimes(1);

    now += 2_000;
    answer(401);
    expect(await tokens.isValid('a.b.c', 123)).toBe(false);
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a 5xx', (): void => answer(502)],
    ['a network error', (): void => void vi.mocked(http).get.mockRejectedValueOnce(new Error('ECONNREFUSED'))],
  ])('refuses without caching on %s', async (_, fail) => {
    const tokens = checker();
    fail();
    expect(await tokens.isValid('a.b.c', 123)).toBe(false);
    answer(200, { user: 123 });
    expect(await tokens.isValid('a.b.c', 123)).toBe(true);
    expect(log.warn).toHaveBeenCalledTimes(1);
  });
});
