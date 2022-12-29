import request from 'supertest';

import { app } from '../../../../src/app';
import type { Status } from '../../../../src/health.service';
import { semverRegex } from '../../../../src/helpers/utils';

describe('GET /health', () => {
  it('responds without authentication', async () => {
    const response = await request(app.callback()).get('/health');
    expect(response.body as Status).toMatchInlineSnapshot(
      {
        startTime: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/),
        // eslint-disable-next-line security/detect-non-literal-regexp
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
