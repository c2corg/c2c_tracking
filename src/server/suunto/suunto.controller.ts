import type { Context } from 'koa';

import type { WebhookEvent } from './suunto.api';
import { suuntoService as service } from './suunto.service';

class SuuntoController {
  public async exchangeToken(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt((ctx['params'] as { userId: string }).userId, 10);
    if (ctx.query['error']) {
      ctx.log.info(`User ${c2cId} denied Suunto authorization`);
      ctx.throw(403, 'auth-denied');
    }
    const authorizationCode = ctx.query['code'] as string;

    try {
      await service.requestShortLivedAccessTokenAndSetupUser(c2cId, authorizationCode);
      ctx.status = 204;
    } catch (error: unknown) {
      ctx.log.info(error);
      ctx.throw(502, 'setup-failed');
    }
  }

  public webhook(ctx: Context): void {
    const event = <WebhookEvent>ctx.request.body;
    const auth = ctx.request.header.authorization;
    void service.handleWebhookEvent(event, auth); // async handling
    ctx.status = 200; // acknowledge event
  }

  public async deauthorize(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt((ctx['params'] as { userId: string }).userId, 10);
    await service.deauthorize(c2cId);
    ctx.status = 204;
  }
}

export const controller = new SuuntoController();
