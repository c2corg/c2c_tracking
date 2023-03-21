import type { Context } from 'koa';

import type { WebhookEvent } from './decathlon.api';
import { decathlonService as service } from './decathlon.service';

class DecathlonController {
  public async exchangeToken(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt((ctx['params'] as { userId: string }).userId, 10);
    if (ctx.query['error']) {
      ctx.log.info(`User ${c2cId} denied Decathlon authorization`);
      ctx.throw(403, 'auth-denied');
    }

    const authorizationCode = ctx.query['code'] as string;
    try {
      await service.requestShortLivedAccessTokenAndSetupUser(c2cId, authorizationCode);
      ctx.status = 204;
    } catch (error: unknown) {
      ctx.throw(502, 'setup-failed');
    }
  }

  public async deauthorize(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt((ctx['params'] as { userId: string }).userId, 10);
    await service.deauthorize(c2cId);
    ctx.status = 204;
  }

  public webhook(ctx: Context): void {
    const event = <WebhookEvent>ctx.request.body;
    void service.handleWebhookEvent(event); // async handling
    ctx.status = 200; // acknowledge event
  }
}

export const controller = new DecathlonController();
