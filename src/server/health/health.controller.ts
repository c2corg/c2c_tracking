import type { Context } from 'koa';

import type { HealthService } from '../../health.service';

export default class HealthController {
  constructor(private readonly health: HealthService) {}

  getHealth(ctx: Context): void {
    const status = this.health.getStatus();

    ctx.body = status;
    ctx.status = status.isShuttingDown ? 503 : 200;
  }
}
