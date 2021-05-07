import { Context } from 'koa';

import { stravaService as service } from './service';

export class StravaController {
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
}
