import Router from '@koa/router';

import { ensureAuthenticated, ensureUserFromParamsMatchesAuthUser } from '../../auth/index.ts';
import { validate } from '../validator.ts';

import { controller } from './suunto.controller.ts';
import { exchangeToken, webhook } from './suunto.validators.ts';

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
