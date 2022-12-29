import config from '../../src/config';
import { HealthService } from '../../src/health.service';
import { semverRegex } from '../../src/helpers/utils';

jest.mock('../../src/config');

describe('Health service', () => {
  it('computes uptime and apps status', () => {
    jest.mocked(config).get.mockImplementation((key) => {
      if (key === 'trackers.strava.enabled') {
        return false;
      }
      if (key === 'version') {
        return '1.0.0';
      }
      return true;
    });
    const timers = jest.useFakeTimers();
    timers.setSystemTime(new Date('2022-01-01'));
    const service = new HealthService();
    timers.setSystemTime(new Date('2022-01-23'));

    expect(service.getStatus()).toMatchInlineSnapshot(
      {
        // eslint-disable-next-line security/detect-non-literal-regexp
        version: expect.stringMatching(new RegExp(semverRegex.source + '|dev')),
      },
      `
      {
        "decathlon": true,
        "garmin": true,
        "polar": true,
        "startTime": "2022-01-01T00:00:00.000Z",
        "strava": false,
        "suunto": true,
        "upTime": "22 days",
        "version": StringMatching /\\^\\(0\\|\\[1-9\\]\\\\d\\*\\)\\\\\\.\\(0\\|\\[1-9\\]\\\\d\\*\\)\\\\\\.\\(0\\|\\[1-9\\]\\\\d\\*\\)\\(\\?:-\\(\\(\\?:0\\|\\[1-9\\]\\\\d\\*\\|\\\\d\\*\\[a-zA-Z-\\]\\[0-9a-zA-Z-\\]\\*\\)\\(\\?:\\\\\\.\\(\\?:0\\|\\[1-9\\]\\\\d\\*\\|\\\\d\\*\\[a-zA-Z-\\]\\[0-9a-zA-Z-\\]\\*\\)\\)\\*\\)\\)\\?\\(\\?:\\\\\\+\\(\\[0-9a-zA-Z-\\]\\+\\(\\?:\\\\\\.\\[0-9a-zA-Z-\\]\\+\\)\\*\\)\\)\\?\\$\\|dev/,
      }
    `,
    );
    jest.useRealTimers();
  });
});
