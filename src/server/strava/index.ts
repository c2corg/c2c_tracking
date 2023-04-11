import Router from '@koa/router';

import { ensureAuthenticated, ensureUserFromParamsMatchesAuthUser } from '../../auth';
import { validate } from '../validator.js';

import { controller } from './strava.controller.js';
import { exchangeToken, webhook, webhookSubscription } from './strava.validators.js';

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
