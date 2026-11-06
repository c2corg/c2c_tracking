import { describe, expect, it, vi } from 'vitest';

import { Database } from '../../../src/db/index.ts';
import * as retryModule from '../../../src/helpers/retry.ts';

const unreachable = new Database({
  host: '127.0.0.1',
  port: 1, // nothing listens there
  user: 'user',
  password: 'password',
  database: 'database',
  ssl: false,
  sslRejectUnauthorized: false,
  sslCaFile: '',
  debug: false,
});

describe('Database connection', () => {
  it('gives up after its attempts, and tries again on the next call', async () => {
    const retry = vi.spyOn(retryModule, 'retry');

    await expect(unreachable.getConnection()).rejects.toThrow(/ECONNREFUSED/);
    await expect(unreachable.getConnection()).rejects.toThrow(/ECONNREFUSED/);

    expect(retry).toHaveBeenCalledTimes(2);
    expect(retry).toHaveBeenCalledWith(expect.any(Function), { times: 3, interval: 1000 });
  }, 10_000);

  it('is not reachable, within the given time', async () => {
    const start = Date.now();

    await expect(unreachable.isReachable(200)).resolves.toBe(false);
    expect(Date.now() - start).toBeLessThan(1000);
  });
});
