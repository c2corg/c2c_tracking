import Router from '@koa/router';

import { ensureAuthenticated, ensureUserFromParamsMatchesAuthUser } from '../../auth/index.ts';
import { validate } from '../validator.ts';

import { controller } from './garmin.controller.ts';
import { activityWebhook, deauthorizeWebhook, exchangeToken } from './garmin.validators.ts';

const router = new Router();

router.get(
  '/request-token/:userId',
  ensureAuthenticated,
  ensureUserFromParamsMatchesAuthUser,
  controller.requestUnauthorizedRequestToken.bind(controller),
);
router.get('/exchange-token/:userId', validate(exchangeToken), controller.exchangeToken.bind(controller));
router.post(
  '/deauthorize/:userId',
  ensureAuthenticated,
  ensureUserFromParamsMatchesAuthUser,
  controller.deauthorize.bind(controller),
);
router.post('/webhook/activities', validate(activityWebhook), controller.activityWebhook.bind(controller));
router.post('/webhook/deauthorize', validate(deauthorizeWebhook), controller.deauthorizeWebhook.bind(controller));

export default router;
