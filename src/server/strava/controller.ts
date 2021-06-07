import { Context } from 'koa';

import { WebhookEvent, WebhookSubscription } from './api';
import { stravaService as service, stravaService } from './service';

class StravaController {
  public async exchangeTokens(ctx: Context): Promise<void> {
    const authorizationCode = ctx.query.code as string;
    const scopes: string[] = (ctx.query.scope as string).split(',');
    const c2cId = Number(ctx.query.state);

    if (!service.containsRequiredScopes(scopes)) {
      ctx.log.info('Auth failed, missing required scopes');
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

  public async webhookSubscription(ctx: Context): Promise<void> {
    const body = <WebhookSubscription>ctx.request.body;
    if (body['hub.verify_token'] !== stravaService.stravaWebhookSubscriptionVerifyToken) {
      ctx.status = 403;
      return;
    }
    ctx.status = 200;
    ctx.body = {
      'hub.challenge': body['hub.challenge'],
    };
  }

  public async webhook(ctx: Context): Promise<void> {
    const event: WebhookEvent = ctx.request.body;
    service.handleWebhookEvent(event); // async handling
    ctx.status = 200; // acknowledge event
  }
}

export const controller = new StravaController();
