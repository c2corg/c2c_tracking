import type { Context } from 'koa';

import type { HealthService } from '../../health.service.js';

export default class HealthController {
  constructor(private readonly health: HealthService) {}

  public getHealth(ctx: Context): void {
    ctx.body = this.health.getStatus();
  }
}
