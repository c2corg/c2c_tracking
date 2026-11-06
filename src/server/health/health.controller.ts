import type { Context } from 'koa';

import type { HealthService } from '../../health.service.ts';

export default class HealthController {
  private readonly health: HealthService;

  constructor(health: HealthService) {
    this.health = health;
  }

  public getHealth(ctx: Context): void {
    ctx.body = this.health.getStatus();
  }
}
