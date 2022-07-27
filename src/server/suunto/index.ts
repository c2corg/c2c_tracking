import Router from '@koa/router';

import { checkEnvvars } from '../../helpers/envar';
import { validate } from '../validator';

import { controller } from './controller';
import { exchangeTokens, webhook, deauthorize } from './validators';

checkEnvvars(
  'SUUNTO_CLIENT_ID',
  'SUUNTO_CLIENT_SECRET',
  'SUUNTO_SUBSCRIPTION_KEY',
  'SUUNTO_WEBHOOK_SUBSCRIPTION_TOKEN',
  'SUUNTO_REDIRECT_URI',
);

const router = new Router();

router.get('/exchange_token/:userId', validate(exchangeTokens), controller.exchangeTokens.bind(controller));
router.post('/webhook', validate(webhook), controller.webhook.bind(controller));
router.get('/deauthorize/:userId', validate(deauthorize), controller.deauthorize.bind(controller));

export default router;
