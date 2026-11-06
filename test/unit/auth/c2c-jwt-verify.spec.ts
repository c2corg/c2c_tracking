import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';

import verify, { verifyWithOffset } from '../../../src/auth/c2c-jwt-verify.ts';
import type { TokenChecker } from '../../../src/auth/c2c-token-check.ts';

const request = (token?: string): Request =>
  ({ headers: token ? { authorization: `JWT token="${token}"` } : {} }) as unknown as Request;

describe('verify', () => {
  it('accepts payload with sub', () => {
    const done = vi.fn((): void => undefined);
    verify(request(), { sub: 123 }, done);

    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(null, { id: 123 });
  });

  it('rejects paylaod without sub', () => {
    const done = vi.fn((): void => undefined);
    verify(request(), {}, done);

    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(null, false);
  });
});

describe('verifyWithOffset', () => {
  const offset = 1_000_000_000;

  it('shifts the user id', () => {
    const done = vi.fn((): void => undefined);
    verifyWithOffset(offset)(request(), { sub: '123' }, done);

    expect(done).toHaveBeenCalledWith(null, { id: offset + 123 });
  });

  it.each([offset, offset + 1, -1, 'abc', 2_000_000_000])('rejects the subject %p', (sub) => {
    const done = vi.fn((): void => undefined);
    verifyWithOffset(offset)(request(), { sub }, done);

    expect(done).toHaveBeenCalledWith(null, false);
  });

  it('rejects payload without sub', () => {
    const done = vi.fn((): void => undefined);
    verifyWithOffset(offset)(request(), {}, done);

    expect(done).toHaveBeenCalledWith(null, false);
  });
});

describe('verifyWithOffset with a checker', () => {
  const checker = (valid: boolean): TokenChecker =>
    ({ isValid: vi.fn().mockResolvedValue(valid) }) as unknown as TokenChecker;
  const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

  it('accepts a token the API confirms', async () => {
    const done = vi.fn((): void => undefined);
    const valid = checker(true);
    verifyWithOffset(0, valid)(request('a.b.c'), { sub: '123' }, done);
    await flush();

    expect(valid.isValid).toHaveBeenCalledWith('a.b.c', 123);
    expect(done).toHaveBeenCalledWith(null, { id: 123 });
  });

  it('checks the subject before the offset', async () => {
    const done = vi.fn((): void => undefined);
    const valid = checker(true);
    verifyWithOffset(1_000_000_000, valid)(request('a.b.c'), { sub: '123' }, done);
    await flush();

    expect(valid.isValid).toHaveBeenCalledWith('a.b.c', 123);
    expect(done).toHaveBeenCalledWith(null, { id: 1_000_000_123 });
  });

  it('rejects a token the API refuses', async () => {
    const done = vi.fn((): void => undefined);
    verifyWithOffset(0, checker(false))(request('a.b.c'), { sub: '123' }, done);
    await flush();

    expect(done).toHaveBeenCalledWith(null, false);
  });

  it('rejects a request without a token', () => {
    const done = vi.fn((): void => undefined);
    const valid = checker(true);
    verifyWithOffset(0, valid)(request(), { sub: '123' }, done);

    expect(valid.isValid).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledWith(null, false);
  });
});
