import { HealthService } from '../../src/health.service';

describe('Health service', () => {
  it('computes uptime', () => {
    const timers = jest.useFakeTimers();
    timers.setSystemTime(new Date('2022-01-01'));
    const service = new HealthService();
    timers.setSystemTime(new Date('2022-01-23'));
    expect(service.getStatus()).toMatchInlineSnapshot(
      {
        version: expect.stringMatching(
          // eslint-disable-next-line security/detect-unsafe-regex
          /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
        ),
      },
      `
      {
        "startTime": "2022-01-01T00:00:00.000Z",
        "upTime": "22 days",
        "version": StringMatching /\\^\\(0\\|\\[1-9\\]\\\\d\\*\\)\\\\\\.\\(0\\|\\[1-9\\]\\\\d\\*\\)\\\\\\.\\(0\\|\\[1-9\\]\\\\d\\*\\)\\(\\?:-\\(\\(\\?:0\\|\\[1-9\\]\\\\d\\*\\|\\\\d\\*\\[a-zA-Z-\\]\\[0-9a-zA-Z-\\]\\*\\)\\(\\?:\\\\\\.\\(\\?:0\\|\\[1-9\\]\\\\d\\*\\|\\\\d\\*\\[a-zA-Z-\\]\\[0-9a-zA-Z-\\]\\*\\)\\)\\*\\)\\)\\?\\(\\?:\\\\\\+\\(\\[0-9a-zA-Z-\\]\\+\\(\\?:\\\\\\.\\[0-9a-zA-Z-\\]\\+\\)\\*\\)\\)\\?\\$/,
      }
    `,
    );
    jest.useRealTimers();
  });
});
