import Router from '@koa/router';

import { checkEnvvars } from '../../helpers/envar';
import { validate } from '../validator';

import { controller } from './controller';
import { exchangeTokens, webhook, webhookSubscription } from './validators';

checkEnvvars('STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET', 'STRAVA_WEBHOOK_SUBSCRIPTION_VERIFY_TOKEN');

const router = new Router();

router.get('/exchange_token/:userId', validate(exchangeTokens), controller.exchangeTokens.bind(controller));
router.get('/webhook', validate(webhookSubscription), controller.webhookSubscription.bind(controller));
router.post('/webhook', validate(webhook), controller.webhook.bind(controller));

export default router;
