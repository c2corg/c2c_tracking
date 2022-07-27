import type { Context } from 'koa';

import type { WebhookEvent, WebhookSubscription } from './api';
import { stravaService as service } from './service';

class StravaController {
  async exchangeTokens(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt(ctx['params'].userId, 10);
    if (ctx.query['error']) {
      ctx.log.info(`User ${c2cId} denied Strava authorization`);
      ctx.redirect(service.subscriptionErrorUrl);
      return;
    }

    const authorizationCode = ctx.query['code'] as string;
    const scopes: string[] = (ctx.query['scope'] as string).split(',');

    if (!service.containsRequiredScopes(scopes)) {
      ctx.log.info('Strava authorization request failed, missing required scopes');
      ctx.redirect(service.subscriptionErrorUrl);
      return;
    }

    try {
      await service.requestShortLivedAccessTokenAndSetupUser(c2cId, authorizationCode);
      ctx.redirect(service.subscriptionSuccessUrl);
    } catch (error) {
      ctx.log.info(error);
      ctx.redirect(service.subscriptionErrorUrl);
    }
  }

  async webhookSubscription(ctx: Context): Promise<void> {
    const query = <WebhookSubscription>(ctx.request.query as unknown);
    if (query['hub.verify_token'] !== service.stravaWebhookSubscriptionVerifyToken) {
      ctx.status = 403;
      return;
    }
    ctx.status = 200;
    ctx.body = {
      'hub.challenge': query['hub.challenge'],
    };
  }

  async webhook(ctx: Context): Promise<void> {
    const event = <WebhookEvent>(ctx.request.body as unknown);
    service.handleWebhookEvent(event); // async handling
    ctx.status = 200; // acknowledge event
  }
}

export const controller = new StravaController();
