import type { Context } from 'koa';

import type { WebhookEvent } from './suunto.api';
import { suuntoService as service } from './suunto.service';

class SuuntoController {
  public async exchangeTokens(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt(ctx['params'].userId, 10);
    if (ctx.query['error']) {
      ctx.log.info(`User ${c2cId} denied Suunto authorization`);
      ctx.redirect(`${service.subscriptionUrl}?error=auth-denied`);
      return;
    }
    const authorizationCode = ctx.query['code'] as string;

    try {
      await service.requestShortLivedAccessTokenAndSetupUser(c2cId, authorizationCode);
      ctx.redirect(service.subscriptionUrl);
    } catch (error: unknown) {
      ctx.log.info(error);
      ctx.redirect(`${service.subscriptionUrl}?error=setup-failed`);
    }
  }

  public async webhook(ctx: Context): Promise<void> {
    const event = <WebhookEvent>(ctx.request.body as unknown);
    const auth = ctx.request.header.authorization;
    service.handleWebhookEvent(event, auth); // async handling
    ctx.status = 200; // acknowledge event
  }

  public async deauthorize(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt(ctx['params'].userId, 10);
    await service.deauthorize(c2cId);
    ctx.status = 204;
  }
}

export const controller = new SuuntoController();
