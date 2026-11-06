import { Router } from 'express';

import { ensureAuthenticated, ensureUserFromParamsMatchesAuthUser, userRateLimit } from '../../auth/index.ts';
import { methodNotAllowed } from '../method-not-allowed.ts';
import { validate } from '../validator.ts';

import { controller } from './strava.controller.ts';
import { exchangeToken, webhook, webhookSubscription } from './strava.validators.ts';

const router = Router();

router
  .route('/exchange-token/:userId')
  .get(
    ensureAuthenticated,
    ensureUserFromParamsMatchesAuthUser,
    userRateLimit,
    validate(exchangeToken),
    controller.exchangeToken.bind(controller),
  )
  .all(methodNotAllowed);
router
  .route('/deauthorize/:userId')
  .post(
    ensureAuthenticated,
    ensureUserFromParamsMatchesAuthUser,
    userRateLimit,
    controller.deauthorize.bind(controller),
  )
  .all(methodNotAllowed);
router
  .route('/webhook')
  .get(validate(webhookSubscription), controller.webhookSubscription.bind(controller))
  .post(validate(webhook), controller.webhook.bind(controller))
  .all(methodNotAllowed);

export default router;
