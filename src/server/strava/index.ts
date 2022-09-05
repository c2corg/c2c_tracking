import Router from '@koa/router';

import simpleAuth from '../../helpers/simple-auth';
import { validate } from '../validator';

import { controller } from './controller';
import { deauthorize, exchangeToken, webhook, webhookSubscription } from './validators';

const router = new Router();

router.get('/exchange-token/:userId', simpleAuth, validate(exchangeToken), controller.exchangeTokens.bind(controller));
router.post('/deauthorize/:userId', simpleAuth, validate(deauthorize), controller.deauthorize.bind(controller));
router.get('/webhook', validate(webhookSubscription), controller.webhookSubscription.bind(controller));
router.post('/webhook', validate(webhook), controller.webhook.bind(controller));

export default router;
