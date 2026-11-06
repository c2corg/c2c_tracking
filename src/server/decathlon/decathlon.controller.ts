import type { Request, Response } from 'express';
import createHttpError from 'http-errors';

import type { WebhookEvent } from './decathlon.api.ts';
import { decathlonService as service } from './decathlon.service.ts';

class DecathlonController {
  public async exchangeToken(req: Request, res: Response): Promise<void> {
    const c2cId = Number.parseInt(req.params['userId'] ?? '', 10);
    if (req.query['error']) {
      req.log.info(`User ${c2cId} denied Decathlon authorization`);
      throw createHttpError(403, 'auth-denied');
    }

    const authorizationCode = req.query['code'] as string;
    try {
      await service.requestShortLivedAccessTokenAndSetupUser(c2cId, authorizationCode);
      res.sendStatus(204);
    } catch {
      throw createHttpError(502, 'setup-failed');
    }
  }

  public async deauthorize(req: Request, res: Response): Promise<void> {
    const c2cId = Number.parseInt(req.params['userId'] ?? '', 10);
    await service.deauthorize(c2cId);
    res.sendStatus(204);
  }

  public webhook(req: Request, res: Response): void {
    const event = req.body as WebhookEvent;
    void service.handleWebhookEvent(event); // async handling
    res.sendStatus(200); // acknowledge event
  }
}

export const controller = new DecathlonController();
