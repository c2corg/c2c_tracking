import { createKeyv } from '@keyv/redis';
import type { Request, Response } from 'express';
import createHttpError from 'http-errors';
import { Keyv } from 'keyv';

import config from '../../config.ts';
import log from '../../helpers/logger.ts';

import type { GarminActivity } from './garmin.api.ts';
import { garminService as service } from './garmin.service.ts';

class GarminController {
  private readonly keyv;

  constructor() {
    const connectionUri = config.get('keyv.connectionUri');
    this.keyv = connectionUri
      ? createKeyv(connectionUri, { namespace: 'tracking' })
      : new Keyv({ namespace: 'tracking' });
    // a store error must not crash the service (throwing from this listener did): the calls then return false or
    // undefined, see below. The URI is not logged, it may hold the Redis password
    this.keyv.on('error', (error: unknown) => {
      log.warn({ err: error }, 'Garmin token secret store error');
    });
  }

  public async requestUnauthorizedRequestToken(req: Request, res: Response): Promise<void> {
    const c2cId = Number.parseInt(req.params['userId'] ?? '', 10);
    const { token, tokenSecret } = await service.requestUnauthorizedRequestToken();
    const stored = await this.keyv.set(c2cId.toString(), tokenSecret, 1000 * 60 * 60); // 1 hour TTL
    if (!stored) {
      // without the secret, the token exchange would fail when the user comes back from Garmin
      throw createHttpError(502, 'setup-failed');
    }
    res.status(200).json({ token });
  }

  public async exchangeToken(req: Request, res: Response): Promise<void> {
    const c2cId = Number.parseInt(req.params['userId'] ?? '', 10);

    const token = req.query['oauth_token'] as string;
    const verifier = req.query['oauth_verifier'] as string;

    if (verifier.toLocaleLowerCase() === 'null') {
      req.log.info(`User ${c2cId} denied Garmin authorization`);
      throw createHttpError(403, 'auth-denied');
    }

    const tokenSecret = (await this.keyv.get(c2cId.toString())) as string;
    if (!tokenSecret) {
      req.log.info(`No token secret found in mem for user ${c2cId}: unable to request Garmin access token`);
      throw createHttpError(502, 'setup-failed');
    }

    try {
      await service.requestAccessTokenAndSetupUser(c2cId, token, tokenSecret, verifier);
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

  public activityWebhook(req: Request, res: Response): void {
    const body = req.body as {
      activityDetails: (GarminActivity & { userId: string; userAccessToken: string })[];
    };
    void service.handleActivityWebhook(body.activityDetails); // async
    res.sendStatus(200);
  }

  public deauthorizeWebhook(req: Request, res: Response): void {
    const body = req.body as { deregistrations: { userId: string; userAccessToken: string }[] };
    void service.handleDeauthorizeWebhook(body.deregistrations); // async
    res.sendStatus(200);
  }
}

export const controller = new GarminController();
