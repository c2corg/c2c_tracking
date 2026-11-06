import type { Server } from 'node:http';

import supertest from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../../../src/app.ts';
import log from '../../../src/helpers/logger.ts';
import { activityService } from '../../../src/server/activities/activity.service.ts';
import { userService } from '../../../src/user.service.ts';
import { authenticated } from '../../utils.ts';

// The ids in the URL paths are validated: parseInt('1abc') is 1, which matched the authenticated user before
describe('Route parameters validation', () => {
  let server: Server;
  let request: ReturnType<typeof supertest>;

  beforeAll(() => {
    server = app.listen();
    request = supertest(server);
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(log, 'info').mockImplementation(() => undefined);
    vi.spyOn(log, 'warn').mockImplementation(() => undefined);
  });

  it.each(['/users/1abc/status', '/users/1abc/activities', '/users/1/activities/2x/geometry'])(
    'answers 400 to %s',
    async (path) => {
      const getUserInfo = vi.spyOn(userService, 'getUserInfo');
      const getActivities = vi.spyOn(activityService, 'getActivities');
      const getActivityGeometry = vi.spyOn(activityService, 'getActivityGeometry');

      const response = await authenticated(request.get(path), 1);

      expect(response.status).toBe(400);
      expect(getUserInfo).not.toHaveBeenCalled();
      expect(getActivities).not.toHaveBeenCalled();
      expect(getActivityGeometry).not.toHaveBeenCalled();
    },
  );

  it.each(['strava', 'suunto', 'garmin', 'decathlon', 'polar', 'coros'])(
    'answers 400 to POST /%s/deauthorize/1abc',
    async (vendor) => {
      const response = await authenticated(request.post(`/${vendor}/deauthorize/1abc`), 1);

      expect(response.status).toBe(400);
    },
  );

  it('still serves valid ids', async () => {
    vi.spyOn(activityService, 'getActivityGeometry').mockResolvedValueOnce({ type: 'LineString', coordinates: [] });

    const response = await authenticated(request.get('/users/1/activities/2/geometry'), 1);

    expect(response.status).toBe(200);
  });
});
