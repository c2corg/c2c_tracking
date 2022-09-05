import Router from '@koa/router';

import simpleAuth from '../../helpers/simple-auth';
import { validate } from '../validator';

import { controller } from './controller';
import { activityWebhook, deauthorize, deauthorizeWebhook, exchangeToken, requestToken } from './validators';

const router = new Router();

router.get(
  '/request-token/:userId',
  simpleAuth,
  validate(requestToken),
  controller.requestUnauthorizedRequestToken.bind(controller),
);
router.get('/exchange-token/:userId', validate(exchangeToken), controller.exchangeToken.bind(controller));
router.post('/deauthorize/:userId', simpleAuth, validate(deauthorize), controller.deauthorize.bind(controller));
router.post('/webhook/activities', validate(activityWebhook), controller.activityWebhook.bind(controller));
router.post('/webhook/deauthorize', validate(deauthorizeWebhook), controller.deauthorizeWebhook.bind(controller));

export default router;
