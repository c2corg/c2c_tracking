import type { Request, Response } from 'express';
import createHttpError from 'http-errors';

import type { WebhookEvent, WebhookSubscription } from './strava.api.ts';
import { stravaService as service } from './strava.service.ts';

class StravaController {
  public async exchangeToken(req: Request, res: Response): Promise<void> {
    const c2cId = Number.parseInt(req.params['userId'] ?? '', 10);
    if (req.query['error']) {
      req.log.info(`User ${c2cId} denied Strava authorization`);
      throw createHttpError(403, 'auth-denied');
    }

    const authorizationCode = req.query['code'] as string;
    const scopes: string[] = (req.query['scope'] as string).split(',');

    if (!service.containsRequiredScopes(scopes)) {
      req.log.info('Strava authorization request failed, missing required scopes');
      throw createHttpError(403, 'unsufficient-scopes');
    }

    try {
      await service.requestShortLivedAccessTokenAndSetupUser(c2cId, authorizationCode);
      res.sendStatus(204);
    } catch (error: unknown) {
      req.log.info(error);
      throw createHttpError(502, 'setup-failed');
    }
  }

  public async deauthorize(req: Request, res: Response): Promise<void> {
    const c2cId = Number.parseInt(req.params['userId'] ?? '', 10);
    await service.deauthorize(c2cId);
    res.sendStatus(204);
  }

  public webhookSubscription(req: Request, res: Response): void {
    const query = req.query as unknown as WebhookSubscription;
    if (query['hub.verify_token'] !== service.stravaWebhookSubscriptionVerifyToken) {
      throw createHttpError(502, 'Invalid verify token');
    }
    res.json({ 'hub.challenge': query['hub.challenge'] });
  }

  public webhook(req: Request, res: Response): void {
    const event = req.body as WebhookEvent;
    void service.handleWebhookEvent(event); // async handling
    res.sendStatus(200); // acknowledge event
  }
}

export const controller = new StravaController();
