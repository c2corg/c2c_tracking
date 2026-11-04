import { createKeyv } from '@keyv/redis';
// eslint-disable-next-line import/no-named-as-default
import Keyv from 'keyv';
import type { Context } from 'koa';
import { z } from 'zod';

import config from '../../config';

import type { GarminActivity } from './garmin.api';
import { garminService as service } from './garmin.service';

const PendingAuthorization = z.object({ state: z.string(), codeVerifier: z.string() });
type PendingAuthorization = z.infer<typeof PendingAuthorization>;

class GarminController {
  private readonly keyv;

  constructor() {
    const connectionUri = config.get('keyv.connectionUri');
    this.keyv = connectionUri
      ? createKeyv(connectionUri, { namespace: 'tracking' })
      : new Keyv({ namespace: 'tracking' });
    this.keyv.on('error', () => {
      throw new Error('Unable to connect to Redis instance with URI ' + connectionUri);
    });
  }

  private pendingKey(c2cId: number): string {
    return `garmin-pkce-${c2cId}`;
  }

  /** Starts the OAuth 2 flow: remembers the PKCE verifier and returns the Garmin consent page URL */
  public async requestAuthorization(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt((ctx['params'] as { userId: string }).userId, 10);
    const { url, state, codeVerifier } = service.startAuthorization();
    const pending: PendingAuthorization = { state, codeVerifier };
    await this.keyv.set(this.pendingKey(c2cId), pending, 1000 * 60 * 60); // 1 hour TTL
    ctx.body = { url };
    ctx.status = 200;
  }

  public async exchangeToken(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt((ctx['params'] as { userId: string }).userId, 10);

    const code = ctx.query['code'] as string | undefined;
    const state = ctx.query['state'] as string | undefined;

    if (ctx.query['error'] || !code) {
      ctx.log.info(`User ${c2cId} denied Garmin authorization`);
      ctx.throw(403, 'auth-denied');
    }

    const pending = PendingAuthorization.safeParse(await this.keyv.get(this.pendingKey(c2cId))).data;
    if (!pending) {
      ctx.log.info(`No pending Garmin authorization found in mem for user ${c2cId}: unable to request Garmin token`);
      ctx.throw(502, 'setup-failed');
    }
    if (pending.state !== state) {
      ctx.log.warn(`Garmin authorization state mismatch for user ${c2cId}`);
      ctx.throw(502, 'setup-failed');
    }
    await this.keyv.delete(this.pendingKey(c2cId)); // single use

    try {
      await service.requestAccessTokenAndSetupUser(c2cId, code, pending.codeVerifier, pending.state);
      ctx.status = 204;
    } catch (error: unknown) {
      ctx.log.info(error);
      ctx.throw(502, 'setup-failed');
    }
  }

  public async deauthorize(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt((ctx['params'] as { userId: string }).userId, 10);
    await service.deauthorize(c2cId);
    ctx.status = 204;
  }

  public activityWebhook(ctx: Context): void {
    const body = ctx.request.body as {
      activityDetails: (GarminActivity & { userId: string; userAccessToken?: string })[];
    };
    void service.handleActivityWebhook(body.activityDetails); // async
    ctx.status = 200;
  }

  public deauthorizeWebhook(ctx: Context): void {
    const body = ctx.request.body as { deregistrations: { userId: string; userAccessToken?: string }[] };
    void service.handleDeauthorizeWebhook(body.deregistrations); // async
    ctx.status = 200;
  }
}

export const controller = new GarminController();
