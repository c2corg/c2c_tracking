import { Context } from 'koa';

import { HealthService } from '../../health.service';

export default class HealthController {
  constructor(private readonly health: HealthService) {}

  public getHealth(ctx: Context): void {
    const status = this.health.getStatus();

    ctx.body = status;
    ctx.status = status.isShuttingDown ? 503 : 200;
  }
}
