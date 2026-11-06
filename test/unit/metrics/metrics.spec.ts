import type { Server } from 'node:http';

import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { app } from '../../../src/app.ts';
import { metricsApp } from '../../../src/metrics/index.ts';
import { activityService } from '../../../src/server/activities/activity.service.ts';
import { authenticated } from '../../utils.ts';

describe('Metrics', () => {
  let appServer: Server;
  let metricsServer: Server;

  beforeAll(() => {
    appServer = app.listen();
    metricsServer = metricsApp.listen();
  });

  afterAll(() => {
    appServer.close();
    metricsServer.close();
  });

  it('exposes the Prometheus metrics, with the response times of the requests', async () => {
    await supertest(appServer).get('/health');

    const response = await supertest(metricsServer).get('/metrics');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/plain/);
    expect(response.text).toMatch(/^service_info\{.*\} 1$/m);
    expect(response.text).toMatch(/^response_time_count\{method="GET",name="\/health",service="c2c_tracking"\} \d+$/m);
  });

  it('labels the response times with the route, not the path', async () => {
    vi.spyOn(activityService, 'getActivities').mockResolvedValueOnce([]);
    await authenticated(supertest(appServer).get('/users/123/activities'), 123);
    await supertest(appServer).get('/unknown/path');

    const response = await supertest(metricsServer).get('/metrics');

    expect(response.text).toMatch(/^response_time_count\{method="GET",name="\/users\/:userId\/activities",.*\} 1$/m);
    expect(response.text).not.toMatch(/name="\/users\/123/);
    expect(response.text).not.toMatch(/name="\/unknown\/path"/);
  });

  it('answers 404 elsewhere', async () => {
    const response = await supertest(metricsServer).get('/other');

    expect(response.status).toBe(404);
  });
});
