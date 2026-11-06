import type { Request, Response } from 'express';

import type { HealthService } from '../../health.service.ts';

export default class HealthController {
  private readonly health: HealthService;

  constructor(health: HealthService) {
    this.health = health;
  }

  public getHealth(_req: Request, res: Response): void {
    res.json(this.health.getStatus());
  }
}
