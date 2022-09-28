import { HealthService } from '../../src/health.service';

describe('Health service', () => {
  it('computes uptime', () => {
    const timers = jest.useFakeTimers();
    timers.setSystemTime(new Date('2022-01-01'));
    const service = new HealthService();
    timers.setSystemTime(new Date('2022-01-23'));
    expect(service.getStatus()).toMatchInlineSnapshot(`
      {
        "isShuttingDown": false,
        "startTime": "2022-01-01T00:00:00.000Z",
        "upTime": "22 days",
      }
    `);
    jest.useRealTimers();
  });

  it('updates shutting down status', () => {
    const service = new HealthService();
    expect(service.getStatus()).toMatchObject({ isShuttingDown: false });
    service.setShuttingDown();
    expect(service.getStatus()).toMatchObject({ isShuttingDown: true });
  });
});
