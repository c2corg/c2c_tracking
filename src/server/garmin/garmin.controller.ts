import { createKeyv } from '@keyv/redis';
// eslint-disable-next-line import/no-named-as-default
import Keyv from 'keyv';
import type { Context } from 'koa';

import config from '../../config';

import type { GarminActivity } from './garmin.api';
import { garminService as service } from './garmin.service';

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

  public async requestUnauthorizedRequestToken(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt((ctx['params'] as { userId: string }).userId, 10);
    const { token, tokenSecret } = await service.requestUnauthorizedRequestToken();
    await this.keyv.set(c2cId.toString(), tokenSecret, 1000 * 60 * 60); // 1 hour TTL
    ctx.body = { token };
    ctx.status = 200;
  }

  public async exchangeToken(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt((ctx['params'] as { userId: string }).userId, 10);

    const token = ctx.query['oauth_token'] as string;
    const verifier = ctx.query['oauth_verifier'] as string;

    if (verifier.toLocaleLowerCase() === 'null') {
      ctx.log.info(`User ${c2cId} denied Garmin authorization`);
      ctx.throw(403, 'auth-denied');
    }

    const tokenSecret = (await this.keyv.get(c2cId.toString())) as string;
    if (!tokenSecret) {
      ctx.log.info(`No token secret found in mem for user ${c2cId}: unable to request Garmin access token`);
      ctx.throw(502, 'setup-failed');
    }

    try {
      await service.requestAccessTokenAndSetupUser(c2cId, token, tokenSecret, verifier);
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
      activityDetails: (GarminActivity & { userId: string; userAccessToken: string })[];
    };
    void service.handleActivityWebhook(body.activityDetails); // async
    ctx.status = 200;
  }

  public deauthorizeWebhook(ctx: Context): void {
    const body = ctx.request.body as { deregistrations: { userId: string; userAccessToken: string }[] };
    void service.handleDeauthorizeWebhook(body.deregistrations); // async
    ctx.status = 200;
  }
}

export const controller = new GarminController();
