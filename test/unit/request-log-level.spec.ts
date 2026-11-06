import { register } from 'prom-client';
import { describe, expect, it, vi } from 'vitest';

import type * as AppModule from '../../src/app.ts';

// Outside of the tests (where they are silent): load the application again in development
const loadRequestLogLevel = async (): Promise<typeof AppModule.requestLogLevel> => {
  const previous = { ...process.env };
  process.env['NODE_ENV'] = 'development';
  try {
    vi.resetModules();
    register.clear(); // the metrics are registered again
    return (await import('../../src/app.ts')).requestLogLevel;
  } finally {
    process.env = previous;
  }
};

describe('requestLogLevel', () => {
  it('logs the requests', async () => {
    const requestLogLevel = await loadRequestLogLevel();

    expect(requestLogLevel('/users/1/activities', undefined)).toBe('info');
  });

  it('does not log the health checks and the ACME challenges that succeed', async () => {
    const requestLogLevel = await loadRequestLogLevel();

    expect(requestLogLevel('/health', undefined)).toBe('silent');
    expect(requestLogLevel('/.well-known/acme-challenge/token', undefined)).toBe('silent');
    expect(requestLogLevel('/health', new Error('failed'))).toBe('info');
  });
});
