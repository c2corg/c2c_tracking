import { Router } from 'express';

import { ensureAuthenticated, ensureUserFromParamsMatchesAuthUser, userRateLimit } from '../../auth/index.ts';
import { methodNotAllowed } from '../method-not-allowed.ts';
import { validate } from '../validator.ts';

import { controller } from './coros.controller.ts';
import { exchangeToken, webhook } from './coros.validators.ts';

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
router.route('/webhook').post(validate(webhook), controller.webhook.bind(controller)).all(methodNotAllowed);

export default router;
