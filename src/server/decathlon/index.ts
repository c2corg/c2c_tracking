import Router from '@koa/router';

import { ensureAuthenticated, ensureUserFromParamsMatchesAuthUser } from '../../auth/index.js';
import { validate } from '../validator.js';

import { controller } from './decathlon.controller.js';
import { exchangeToken, webhook } from './decathlon.validators.js';

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
router.post('/webhook', validate(webhook), controller.webhook.bind(controller));

export default router;
