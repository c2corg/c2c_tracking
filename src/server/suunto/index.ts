import Router from '@koa/router';

import { checkEnvvars } from '../../helpers/envar';
import { validate } from '../validator';

import { controller } from './controller';
import { exchangeTokens, webhook } from './validators';

checkEnvvars(
  'SUUNTO_CLIENT_ID',
  'SUUNTO_CLIENT_SECRET',
  'SUUNTO_SUBSCRIPTION_KEY',
  'SUUNTO_WEBHOOK_SUBSCRIPTION_TOKEN',
);

const router = new Router();

router.get('/exchange_token/:userId', validate(exchangeTokens), controller.exchangeTokens.bind(controller));
router.post('/webhook', validate(webhook), controller.webhook.bind(controller));

export default router;
