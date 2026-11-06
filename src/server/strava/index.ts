import Router from '@koa/router';

import { ensureAuthenticated, ensureUserFromParamsMatchesAuthUser } from '../../auth/index.ts';
import { validate } from '../validator.ts';

import { controller } from './strava.controller.ts';
import { exchangeToken, webhook, webhookSubscription } from './strava.validators.ts';

const router = new Router();

router.get(
  '/exchange-token/:userId',
  ensureAuthenticated,
  ensureUserFromParamsMatchesAuthUser,
  validate(exchangeToken),
  controller.exchangeToken.bind(controller),
);
router.post(
  '/deauthorize/:userId',
  ensureAuthenticated,
  ensureUserFromParamsMatchesAuthUser,
  controller.deauthorize.bind(controller),
);
router.get('/webhook', validate(webhookSubscription), controller.webhookSubscription.bind(controller));
router.post('/webhook', validate(webhook), controller.webhook.bind(controller));

export default router;
