import type { Context } from 'koa';

import type { WebhookEvent } from './api';
import { suuntoService as service } from './service';

class SuuntoController {
  async exchangeTokens(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt(ctx['params'].userId, 10);
    if (ctx.query['error']) {
      ctx.log.info(`User ${c2cId} denied Suunto authorization`);
      ctx.redirect(service.subscriptionErrorUrl);
      return;
    }
    const authorizationCode = ctx.query['code'] as string;

    try {
      await service.requestShortLivedAccessTokenAndSetupUser(c2cId, authorizationCode);
      ctx.redirect(service.subscriptionSuccessUrl);
    } catch (error) {
      ctx.log.info(error);
      ctx.redirect(service.subscriptionErrorUrl);
    }
  }

  async webhook(ctx: Context): Promise<void> {
    const event = <WebhookEvent>(ctx.request.body as unknown);
    const auth = ctx.request.header.authorization;
    service.handleWebhookEvent(event, auth); // async handling
    ctx.status = 200; // acknowledge event
  }

  async deauthorize(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt(ctx['params'].userId, 10);
    try {
      await service.deauthorize(c2cId);
      ctx.redirect(service.subscriptionSuccessUrl);
    } catch (error) {
      ctx.log.info(error);
      ctx.redirect(service.subscriptionErrorUrl); // TODO better feedback
    }
  }
}

export const controller = new SuuntoController();
