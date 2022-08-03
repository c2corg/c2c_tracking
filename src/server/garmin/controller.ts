import axios from 'axios';
import Keyv from 'keyv';
import type { Context } from 'koa';

import type { GarminActivity } from './api';
import { garminService as service } from './service';

class GarminController {
  private readonly exchangeTokenUrl;
  private readonly keyv;

  constructor() {
    this.exchangeTokenUrl = `${process.env['SERVER_BASE_URL']!}/garmin/exchange-token`; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    this.keyv = new Keyv();
  }

  async requestUnauthorizedRequestToken(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt(ctx['params'].userId, 10);
    const { token, tokenSecret } = await service.requestUnauthorizedRequestToken();
    await this.keyv.set(c2cId.toString(), tokenSecret, 1000 * 60 * 60); // 1 hour TTL
    ctx.redirect(
      `https://connect.garmin.com/oauthConfirm?oauth_token=${token}&oauth_callback=${this.exchangeTokenUrl}/${c2cId}`,
    );
  }

  async exchangeToken(ctx: Context): Promise<void> {
    const c2cId = Number.parseInt(ctx['params'].userId, 10);

    const token = ctx.query['oauth_token'] as string;
    const verifier = ctx.query['oauth_verifier'] as string;

    if (verifier === 'null') {
      ctx.log.info(`User ${c2cId} denied Garmin authorization`);
      ctx.redirect(`${service.subscriptionUrl}?error=auth-denied`);
      return;
    }

    const tokenSecret = (await this.keyv.get(c2cId.toString())) as string;
    if (!tokenSecret) {
      ctx.log.info(`No token secret found in mem for user ${c2cId}: unable to request Garmin access token`);
      ctx.redirect(`${service.subscriptionUrl}?error=setup-failed`);
      return;
    }

    try {
      await service.requestAccessTokenAndSetupUser(c2cId, token, tokenSecret, verifier);
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

  async activityWebhook(ctx: Context): Promise<void> {
    const body: { activityDetails: (GarminActivity & { userId: string; userAccessToken: string })[] } =
      ctx.request.body;
    service.handleActivityWebhook(body.activityDetails); // async
    ctx.status = 200;
  }

  async deauthorizeWebhook(ctx: Context): Promise<void> {
    const body: { deregistrations: { userId: string; userAccessToken: string }[] } = ctx.request.body;
    service.handleDeauthorizeWebhook(body.deregistrations); // async
    ctx.status = 200;
  }
}

export const controller = new GarminController();
