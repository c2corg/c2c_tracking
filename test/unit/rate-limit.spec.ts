import type { Server } from 'node:http';

import { register } from 'prom-client';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { authenticated } from '../utils.ts';

describe('Rate limit of the authenticated routes', () => {
  let server: Server;

  beforeAll(async () => {
    const previous = { ...process.env };
    process.env['SERVER_USER_RATE_LIMIT'] = '3';
    try {
      vi.resetModules();
      register.clear(); // the metrics are registered again
      server = (await import('../../src/app.ts')).app.listen();
    } finally {
      process.env = previous;
    }
  });

  afterAll(() => {
    server.close();
  });

  it('answers 429 over the limit of a user, without affecting the others', async () => {
    const { userService: reloaded } = await import('../../src/user.service.ts');
    vi.spyOn(reloaded, 'getUserInfo').mockResolvedValue({});
    const request = supertest(server);

    const statuses = [];
    for (let i = 0; i < 4; i++) {
      statuses.push((await authenticated(request.get('/users/1/status'), 1)).status);
    }
    const other = await authenticated(request.get('/users/2/status'), 2);

    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(other.status).toBe(200);
  });
});
