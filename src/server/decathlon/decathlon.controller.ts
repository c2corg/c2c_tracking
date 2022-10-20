import axios from 'axios';
import type { Context } from 'koa';

import type { WebhookEvent } from './decathlon.api';
import { decathlonService as service } from './decathlon.service';

class DecathlonController {
  async exchangeTokens(ctx: Context): Promise<void> {
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
    } catch (error) {
      ctx.log.info(error);
      ctx.redirect(`${service.subscriptionUrl}?error=setup-failed`);
    }
  }

  async deauthorize(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt(ctx['params'].userId, 10);
    try {
      await service.deauthorize(c2cId);
      ctx.status = 200;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error;
      }
      ctx.log.info(error);
      ctx.status = 501;
    }
  }

  async webhook(ctx: Context): Promise<void> {
    const event = <WebhookEvent>(ctx.request.body as unknown);
    service.handleWebhookEvent(event); // async handling
    ctx.status = 200; // acknowledge event
  }
}

export const controller = new DecathlonController();
