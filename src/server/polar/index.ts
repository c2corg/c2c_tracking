import Router from '@koa/router';

import { ensureAuthenticated, ensureUserFromParamsMatchesAuthUser } from '../../auth';
import { validate } from '../validator.js';

import { controller } from './polar.controller';
import { exchangeToken, webhook } from './polar.validators';

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
