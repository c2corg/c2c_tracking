import Router from '@koa/router';

import { ensureAuthenticated, ensureUserFromParams } from '../../auth';
import { validate } from '../validator';

import { controller } from './controller';
import { exchangeToken, webhook, deauthorize } from './validators';

const router = new Router();

router.get(
  '/exchange-token/:userId',
  ensureAuthenticated,
  ensureUserFromParams,
  validate(exchangeToken),
  controller.exchangeTokens.bind(controller),
);
router.post(
  '/deauthorize/:userId',
  ensureAuthenticated,
  ensureUserFromParams,
  validate(deauthorize),
  controller.deauthorize.bind(controller),
);
router.post('/webhook', validate(webhook), controller.webhook.bind(controller));

export default router;
