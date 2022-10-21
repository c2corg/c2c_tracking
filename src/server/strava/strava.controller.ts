import type { Context } from 'koa';

import { ExternalApiError } from '../../errors';

import type { WebhookEvent, WebhookSubscription } from './strava.api';
import { stravaService as service } from './strava.service';

class StravaController {
  public async exchangeTokens(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt(ctx['params'].userId, 10);
    if (ctx.query['error']) {
      ctx.log.info(`User ${c2cId} denied Strava authorization`);
      ctx.redirect(`${service.subscriptionUrl}?error=auth-denied`);
      return;
    }

    const authorizationCode = ctx.query['code'] as string;
    const scopes: string[] = (ctx.query['scope'] as string).split(',');

    if (!service.containsRequiredScopes(scopes)) {
      ctx.log.info('Strava authorization request failed, missing required scopes');
      ctx.redirect(`${service.subscriptionUrl}?error=unsufficient-scopes`);
      return;
    }

    try {
      await service.requestShortLivedAccessTokenAndSetupUser(c2cId, authorizationCode);
      ctx.redirect(service.subscriptionUrl);
    } catch (error: unknown) {
      ctx.log.info(error);
      ctx.redirect(`${service.subscriptionUrl}?error=setup-failed`);
    }
  }

  public async deauthorize(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt(ctx['params'].userId, 10);
    await service.deauthorize(c2cId);
    ctx.status = 204;
  }

  public async webhookSubscription(ctx: Context): Promise<void> {
    const query = <WebhookSubscription>(ctx.request.query as unknown);
    if (query['hub.verify_token'] !== service.stravaWebhookSubscriptionVerifyToken) {
      throw new ExternalApiError('Invalid verify token');
    }
    ctx.body = { 'hub.challenge': query['hub.challenge'] };
  }

  public async webhook(ctx: Context): Promise<void> {
    const event = <WebhookEvent>(ctx.request.body as unknown);
    service.handleWebhookEvent(event); // async handling
    ctx.status = 200; // acknowledge event
  }
}

export const controller = new StravaController();
