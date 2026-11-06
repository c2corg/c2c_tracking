import type { Server } from 'node:http';

import { register } from 'prom-client';
import supertest from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as AppModule from '../../src/app.ts';

// The configuration is read when the modules are loaded: load the application again for each environment
const loadApp = async (env: Record<string, string>): Promise<typeof AppModule.app> => {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  try {
    vi.resetModules();
    register.clear(); // the metrics are registered again
    const { app } = await import('../../src/app.ts');
    return app;
  } finally {
    process.env = previous;
  }
};

describe('Application configuration', () => {
  let server: Server | undefined;

  afterEach(() => {
    server?.close();
    server = undefined;
  });

  it('answers 405 on the routes of a disabled tracker', async () => {
    server = (await loadApp({ STRAVA_ENABLED: 'false' })).listen();

    const response = await supertest(server).get('/strava/webhook');

    expect(response.status).toBe(405);
  });

  it('serves the routes of an enabled tracker', async () => {
    server = (await loadApp({ STRAVA_ENABLED: 'true' })).listen();

    const response = await supertest(server).get('/strava/webhook');

    expect(response.status).not.toBe(405);
    expect(response.status).not.toBe(404);
  });

  it('answers 413 to a JSON body over the configured limit', async () => {
    server = (await loadApp({ SERVER_PAYLOAD_MAX_SIZE: '1kb' })).listen();

    const response = await supertest(server)
      .post('/strava/webhook')
      .send({ padding: 'x'.repeat(2048) });

    expect(response.status).toBe(413);
  });

  it('allows the extra frontend origins', async () => {
    server = (await loadApp({ FRONTEND_EXTRA_ORIGINS: 'https://preprod.example.org' })).listen();

    const response = await supertest(server).get('/health').set('Origin', 'https://preprod.example.org');

    expect(response.headers['access-control-allow-origin']).toBe('https://preprod.example.org');
  });
});
