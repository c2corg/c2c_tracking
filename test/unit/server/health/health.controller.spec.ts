import request from 'supertest';

import { app } from '../../../../src/app';
import type { Status } from '../../../../src/health.service';

describe('GET /health', () => {
  it('responds without authentication', async () => {
    const response = await request(app.callback()).get('/health');
    expect(response.body as Status).toMatchInlineSnapshot(
      {
        startTime: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/),
      },
      `
      {
        "isShuttingDown": false,
        "startTime": StringMatching /\\\\d\\{4\\}-\\\\d\\{2\\}-\\\\d\\{2\\}T\\\\d\\{2\\}:\\\\d\\{2\\}:\\\\d\\{2\\}\\\\\\.\\\\d\\{3\\}Z/,
        "upTime": "a few seconds",
      }
    `,
    );
    expect(response.status).toBe(200);
  });
});
