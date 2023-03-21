import type { Context } from 'koa';

import type { WebhookEvent, WebhookSubscription } from './strava.api';
import { stravaService as service } from './strava.service';

class StravaController {
  public async exchangeToken(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt((ctx['params'] as { userId: string }).userId, 10);
    if (ctx.query['error']) {
      ctx.log.info(`User ${c2cId} denied Strava authorization`);
      ctx.throw(403, 'auth-denied');
    }

    const authorizationCode = ctx.query['code'] as string;
    const scopes: string[] = (ctx.query['scope'] as string).split(',');

    if (!service.containsRequiredScopes(scopes)) {
      ctx.log.info('Strava authorization request failed, missing required scopes');
      ctx.throw(403, 'unsufficient-scopes');
    }

    try {
      await service.requestShortLivedAccessTokenAndSetupUser(c2cId, authorizationCode);
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

  public webhookSubscription(ctx: Context): void {
    const query = <WebhookSubscription>(ctx.request.query as unknown);
    if (query['hub.verify_token'] !== service.stravaWebhookSubscriptionVerifyToken) {
      ctx.throw(502, 'Invalid verify token');
    }
    ctx.body = { 'hub.challenge': query['hub.challenge'] };
  }

  public webhook(ctx: Context): void {
    const event = <WebhookEvent>ctx.request.body;
    void service.handleWebhookEvent(event); // async handling
    ctx.status = 200; // acknowledge event
  }
}

export const controller = new StravaController();
