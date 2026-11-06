import type { Server } from 'http';

import supertest from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../../../../src/app.ts';
import log from '../../../../src/helpers/logger.ts';
import { userService } from '../../../../src/user.service.ts';
import { authenticated } from '../../../utils.ts';

describe('User Controller', () => {
  let server: Server;
  let request: TestAgent;

  beforeAll(() => {
    server = app.listen();
    request = supertest(server);
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    vi.spyOn(log, 'info').mockImplementation(() => {
      /* do nothing */
    });
    vi.spyOn(log, 'warn').mockImplementation(() => {
      /* do nothing */
    });
  });

  describe('GET /users/:userId/status', () => {
    it('requires an authenticated user', async () => {
      const response = await request.get('/users/1/status');

      expect(response.status).toBe(401);
    });

    it('requires matching authenticated user', async () => {
      const response = await authenticated(request.get('/users/1/status'), 2);

      expect(response.status).toBe(403);
    });

    it('responds with user activities summaries', async () => {
      vi.spyOn(userService, 'getUserInfo').mockResolvedValueOnce({
        decathlon: 'configured',
        garmin: 'not-configured',
        strava: 'token-lost',
        suunto: 'configured',
        polar: 'configured',
      });

      const response = await authenticated(request.get('/users/1/status'), 1);

      expect(response.status).toBe(200);
      expect(response.body).toMatchInlineSnapshot(`
        {
          "decathlon": "configured",
          "garmin": "not-configured",
          "polar": "configured",
          "strava": "token-lost",
          "suunto": "configured",
        }
      `);
      expect(userService.getUserInfo).toHaveBeenCalledTimes(1);
      expect(userService.getUserInfo).toHaveBeenCalledWith(1);
    });
  });
});
