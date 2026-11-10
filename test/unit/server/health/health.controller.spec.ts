import type { Server } from 'http';

import supertest from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { app } from '../../../../src/app.ts';
import { database } from '../../../../src/db/index.ts';
import type { Status } from '../../../../src/health.service.ts';
import { semverRegex } from '../../../../src/helpers/utils.ts';

describe('GET /health', () => {
  let server: Server;
  let request: TestAgent;

  beforeAll(() => {
    server = app.listen();
    request = supertest(server);
  });

  afterAll(() => {
    server.close();
  });

  it('responds without authentication', async () => {
    const response = await request.get('/health');
    expect(response.body as Status).toMatchInlineSnapshot(
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        startTime: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/),
        // eslint-disable-next-line security/detect-non-literal-regexp, @typescript-eslint/no-unsafe-assignment
        version: expect.stringMatching(new RegExp(semverRegex.source + '|dev')),
      },
      `
      {
        "decathlon": true,
        "garmin": true,
        "polar": true,
        "startTime": StringMatching /\\\\d\\{4\\}-\\\\d\\{2\\}-\\\\d\\{2\\}T\\\\d\\{2\\}:\\\\d\\{2\\}:\\\\d\\{2\\}\\\\\\.\\\\d\\{3\\}Z/,
        "strava": true,
        "suunto": true,
        "upTime": "a few seconds",
        "version": StringMatching /\\^\\(0\\|\\[1-9\\]\\\\d\\*\\)\\\\\\.\\(0\\|\\[1-9\\]\\\\d\\*\\)\\\\\\.\\(0\\|\\[1-9\\]\\\\d\\*\\)\\(\\?:-\\(\\(\\?:0\\|\\[1-9\\]\\\\d\\*\\|\\\\d\\*\\[a-zA-Z-\\]\\[0-9a-zA-Z-\\]\\*\\)\\(\\?:\\\\\\.\\(\\?:0\\|\\[1-9\\]\\\\d\\*\\|\\\\d\\*\\[a-zA-Z-\\]\\[0-9a-zA-Z-\\]\\*\\)\\)\\*\\)\\)\\?\\(\\?:\\\\\\+\\(\\[0-9a-zA-Z-\\]\\+\\(\\?:\\\\\\.\\[0-9a-zA-Z-\\]\\+\\)\\*\\)\\)\\?\\$\\|dev/,
      }
    `,
    );
    expect(response.status).toBe(200);
  });
});

describe('GET /health/ready', () => {
  let server: Server;
  let request: TestAgent;

  beforeAll(() => {
    server = app.listen();
    request = supertest(server);
  });

  afterAll(() => {
    server.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is ready when the database answers', async () => {
    vi.spyOn(database, 'isReachable').mockResolvedValueOnce(true);

    const response = await request.get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', checks: { database: 'ok' } });
  });

  it('is not ready when the database does not answer', async () => {
    vi.spyOn(database, 'isReachable').mockResolvedValueOnce(false);

    const response = await request.get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable', checks: { database: 'unavailable' } });
  });
});
