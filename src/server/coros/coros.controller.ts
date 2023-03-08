import type { Context } from 'koa';

import type { WebhookEvent } from './coros.api';
import { corosService as service } from './coros.service';

class CorosController {
  public async exchangeToken(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt(ctx['params'].userId, 10);
    if (!ctx.query['code']) {
      ctx.log.info(`User ${c2cId} denied Coros authorization`);
      ctx.throw(403, 'auth-denied');
    }

    const authorizationCode = ctx.query['code'] as string;

    try {
      await service.requestAccessTokenAndSetupUser(c2cId, authorizationCode);
      ctx.status = 204;
    } catch (error: unknown) {
      ctx.log.info(error);
      ctx.throw(502, 'setup-failed');
    }
  }

  public async deauthorize(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt(ctx['params'].userId, 10);
    await service.deauthorize(c2cId);
    ctx.status = 204;
  }

  public async webhook(ctx: Context): Promise<void> {
    const event = <WebhookEvent>ctx.request.body;
    service.handleWebhookEvent(event, ctx.get('client'), ctx.get('secret')); // async handling
    ctx.status = 200; // acknowledge event
    ctx.body = { message: 'ok', result: '0000' };
  }
}

export const controller = new CorosController();
