import request from 'supertest';

import { app } from '../../../../src/app';
import type { Status } from '../../../../src/health.service';

describe('GET /health', () => {
  it('responds without authentication', async () => {
    const response = await request(app.callback()).get('/health');
    expect(response.body as Status).toMatchInlineSnapshot(
      {
        startTime: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/),
        version: expect.stringMatching(
          // eslint-disable-next-line security/detect-unsafe-regex
          /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
        ),
      },
      `
      {
        "startTime": StringMatching /\\\\d\\{4\\}-\\\\d\\{2\\}-\\\\d\\{2\\}T\\\\d\\{2\\}:\\\\d\\{2\\}:\\\\d\\{2\\}\\\\\\.\\\\d\\{3\\}Z/,
        "upTime": "a few seconds",
        "version": StringMatching /\\^\\(0\\|\\[1-9\\]\\\\d\\*\\)\\\\\\.\\(0\\|\\[1-9\\]\\\\d\\*\\)\\\\\\.\\(0\\|\\[1-9\\]\\\\d\\*\\)\\(\\?:-\\(\\(\\?:0\\|\\[1-9\\]\\\\d\\*\\|\\\\d\\*\\[a-zA-Z-\\]\\[0-9a-zA-Z-\\]\\*\\)\\(\\?:\\\\\\.\\(\\?:0\\|\\[1-9\\]\\\\d\\*\\|\\\\d\\*\\[a-zA-Z-\\]\\[0-9a-zA-Z-\\]\\*\\)\\)\\*\\)\\)\\?\\(\\?:\\\\\\+\\(\\[0-9a-zA-Z-\\]\\+\\(\\?:\\\\\\.\\[0-9a-zA-Z-\\]\\+\\)\\*\\)\\)\\?\\$/,
      }
    `,
    );
    expect(response.status).toBe(200);
  });
});
