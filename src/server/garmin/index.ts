import { Router } from 'express';

import { ensureAuthenticated, ensureUserFromParamsMatchesAuthUser } from '../../auth/index.ts';
import { methodNotAllowed } from '../method-not-allowed.ts';
import { validate } from '../validator.ts';

import { controller } from './garmin.controller.ts';
import { activityWebhook, deauthorizeWebhook, exchangeToken } from './garmin.validators.ts';

const router = Router();

router
  .route('/request-token/:userId')
  .get(
    ensureAuthenticated,
    ensureUserFromParamsMatchesAuthUser,
    controller.requestUnauthorizedRequestToken.bind(controller),
  )
  .all(methodNotAllowed);
router
  .route('/exchange-token/:userId')
  .get(validate(exchangeToken), controller.exchangeToken.bind(controller))
  .all(methodNotAllowed);
router
  .route('/deauthorize/:userId')
  .post(ensureAuthenticated, ensureUserFromParamsMatchesAuthUser, controller.deauthorize.bind(controller))
  .all(methodNotAllowed);
router
  .route('/webhook/activities')
  .post(validate(activityWebhook), controller.activityWebhook.bind(controller))
  .all(methodNotAllowed);
router
  .route('/webhook/deauthorize')
  .post(validate(deauthorizeWebhook), controller.deauthorizeWebhook.bind(controller))
  .all(methodNotAllowed);

export default router;
