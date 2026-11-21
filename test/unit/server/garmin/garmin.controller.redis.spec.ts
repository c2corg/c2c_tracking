import { Keyv } from 'keyv';
import { afterEach, describe, expect, it, vi } from 'vitest';

const createKeyv = vi.hoisted(() => vi.fn());

vi.mock('@keyv/redis', () => ({ createKeyv }));

describe('Garmin Controller store', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('talks RESP2 to Redis, the only protocol Redis 5 knows', async () => {
    vi.stubEnv('KEYV_CONNECTION_URI', 'redis://redis:6379/');
    createKeyv.mockReturnValueOnce(new Keyv());

    await import('../../../../src/server/garmin/garmin.controller.ts');

    expect(createKeyv).toHaveBeenCalledWith({ url: 'redis://redis:6379/', RESP: 2 }, { namespace: 'tracking' });
  });
});
