import type { Request, Response } from 'express';
import createHttpError from 'http-errors';

import type { WebhookEvent } from './suunto.api.ts';
import { suuntoService as service } from './suunto.service.ts';

class SuuntoController {
  public async exchangeToken(req: Request, res: Response): Promise<void> {
    const c2cId = Number.parseInt(req.params['userId'] ?? '', 10);
    if (req.query['error']) {
      req.log.info(`User ${c2cId} denied Suunto authorization`);
      throw createHttpError(403, 'auth-denied');
    }
    const authorizationCode = req.query['code'] as string;

    try {
      await service.requestShortLivedAccessTokenAndSetupUser(c2cId, authorizationCode);
      res.sendStatus(204);
    } catch (error: unknown) {
      req.log.info(error);
      throw createHttpError(502, 'setup-failed');
    }
  }

  public webhook(req: Request, res: Response): void {
    const event = req.body as WebhookEvent;
    const auth = req.headers.authorization;
    void service.handleWebhookEvent(event, auth); // async handling
    res.sendStatus(200); // acknowledge event
  }

  public async deauthorize(req: Request, res: Response): Promise<void> {
    const c2cId = Number.parseInt(req.params['userId'] ?? '', 10);
    await service.deauthorize(c2cId);
    res.sendStatus(204);
  }
}

export const controller = new SuuntoController();
