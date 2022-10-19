import { HealthService } from '../../src/health.service';

describe('Health service', () => {
  it('computes uptime', () => {
    const timers = jest.useFakeTimers();
    timers.setSystemTime(new Date('2022-01-01'));
    const service = new HealthService();
    timers.setSystemTime(new Date('2022-01-23'));
    expect(service.getStatus()).toMatchInlineSnapshot(`
      {
        "startTime": "2022-01-01T00:00:00.000Z",
        "upTime": "22 days",
      }
    `);
    jest.useRealTimers();
  });
});
