import Router from '@koa/router';

import { checkEnvvars } from '../../helpers/envar';
import { validate } from '../validator';

import { controller } from './controller';
import { activityWebhook, deauthorize, deauthorizeWebhook, exchangeToken, requestToken } from './validators';

checkEnvvars('GARMIN_CONSUMER_KEY', 'GARMIN_CONSUMER_SECRET');

const router = new Router();

router.get(
  '/request-token/:userId',
  validate(requestToken),
  controller.requestUnauthorizedRequestToken.bind(controller),
);
router.get('/exchange-token/:userId', validate(exchangeToken), controller.exchangeToken.bind(controller));
router.post('/deauthorize/:userId', validate(deauthorize), controller.deauthorize.bind(controller));
router.post('/webhook/activities', validate(activityWebhook), controller.activityWebhook.bind(controller));
router.post('/webhook/deauthorize', validate(deauthorizeWebhook), controller.deauthorizeWebhook.bind(controller));

export default router;
