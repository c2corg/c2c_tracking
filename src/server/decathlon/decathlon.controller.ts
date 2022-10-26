import type { Context } from 'koa';

import type { WebhookEvent } from './decathlon.api';
import { decathlonService as service } from './decathlon.service';

class DecathlonController {
  public async exchangeTokens(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt(ctx['params'].userId, 10);
    if (ctx.query['error']) {
      ctx.log.info(`User ${c2cId} denied Decathlon authorization`);
      ctx.redirect(`${service.subscriptionUrl}?error=auth-denied`);
      return;
    }

    const authorizationCode = ctx.query['code'] as string;
    try {
      await service.requestShortLivedAccessTokenAndSetupUser(c2cId, authorizationCode);
      ctx.redirect(service.subscriptionUrl);
    } catch (error: unknown) {
      ctx.redirect(`${service.subscriptionUrl}?error=setup-failed`);
    }
  }

  public async deauthorize(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt(ctx['params'].userId, 10);
    await service.deauthorize(c2cId);
    ctx.status = 204;
  }

  public async webhook(ctx: Context): Promise<void> {
    const event = <WebhookEvent>(ctx.request.body as unknown);
    service.handleWebhookEvent(event); // async handling
    ctx.status = 200; // acknowledge event
  }
}

export const controller = new DecathlonController();
