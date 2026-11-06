import { createKeyv } from '@keyv/redis';
import type { Request, Response } from 'express';
import createHttpError from 'http-errors';
import { Keyv } from 'keyv';
import { z } from 'zod';

import config from '../../config.ts';
import log from '../../helpers/logger.ts';

import type { GarminActivity } from './garmin.api.ts';
import { garminService as service } from './garmin.service.ts';

const PendingAuthorization = z.object({ state: z.string(), codeVerifier: z.string() });
type PendingAuthorization = z.infer<typeof PendingAuthorization>;

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
      log.warn({ err: error }, 'Garmin pending authorization store error');
    });
  }

  private pendingKey(c2cId: number): string {
    return `garmin-pkce-${c2cId}`;
  }

  /** Starts the OAuth 2 flow: remembers the PKCE verifier and returns the Garmin consent page URL */
  public async requestAuthorization(req: Request, res: Response): Promise<void> {
    const c2cId = Number.parseInt(req.params['userId'] ?? '', 10);
    const { url, state, codeVerifier } = service.startAuthorization();
    const pending: PendingAuthorization = { state, codeVerifier };
    const stored = await this.keyv.set(this.pendingKey(c2cId), pending, 1000 * 60 * 60); // 1 hour TTL
    if (!stored) {
      // without the verifier, the token exchange would fail when the user comes back from Garmin
      throw createHttpError(502, 'setup-failed');
    }
    res.status(200).json({ url });
  }

  public async exchangeToken(req: Request, res: Response): Promise<void> {
    const c2cId = Number.parseInt(req.params['userId'] ?? '', 10);

    const code = req.query['code'] as string | undefined;
    const state = req.query['state'] as string | undefined;

    if (req.query['error'] || !code) {
      req.log.info(`User ${c2cId} denied Garmin authorization`);
      throw createHttpError(403, 'auth-denied');
    }

    const pending = PendingAuthorization.safeParse(await this.keyv.get(this.pendingKey(c2cId))).data;
    if (!pending) {
      req.log.info(`No pending Garmin authorization found in mem for user ${c2cId}: unable to request Garmin token`);
      throw createHttpError(502, 'setup-failed');
    }
    if (pending.state !== state) {
      req.log.warn(`Garmin authorization state mismatch for user ${c2cId}`);
      throw createHttpError(502, 'setup-failed');
    }
    await this.keyv.delete(this.pendingKey(c2cId)); // single use

    try {
      await service.requestAccessTokenAndSetupUser(c2cId, code, pending.codeVerifier, pending.state);
      res.sendStatus(204);
    } catch (error: unknown) {
      req.log.info({ err: error }, 'Garmin token request failed');
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
      activityDetails: (GarminActivity & { userId: string; userAccessToken?: string })[];
    };
    void service.handleActivityWebhook(body.activityDetails); // async
    res.sendStatus(200);
  }

  public deauthorizeWebhook(req: Request, res: Response): void {
    const body = req.body as { deregistrations: { userId: string; userAccessToken?: string }[] };
    void service.handleDeauthorizeWebhook(body.deregistrations); // async
    res.sendStatus(200);
  }
}

export const controller = new GarminController();
