import type { Request, Response } from 'express';

import type { Database } from '../../db/index.ts';
import type { HealthService } from '../../health.service.ts';

export default class HealthController {
  private readonly health: HealthService;
  private readonly database: Database;

  constructor(health: HealthService, database: Database) {
    this.health = health;
    this.database = database;
  }

  // Liveness: the process answers
  public getHealth(_req: Request, res: Response): void {
    res.json(this.health.getStatus());
  }

  // Readiness: the service can handle requests, its database answers
  public async getReadiness(_req: Request, res: Response): Promise<void> {
    const database = await this.database.isReachable();
    res.status(database ? 200 : 503).json({
      status: database ? 'ok' : 'unavailable',
      checks: { database: database ? 'ok' : 'unavailable' },
    });
  }
}
