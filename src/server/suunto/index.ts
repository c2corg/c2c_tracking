import Router from '@koa/router';

import { validate } from '../validator';

import { controller } from './controller';
import { exchangeToken, webhook, deauthorize } from './validators';

const router = new Router();

router.get('/exchange-token/:userId', validate(exchangeToken), controller.exchangeTokens.bind(controller));
router.post('/webhook', validate(webhook), controller.webhook.bind(controller));
router.post('/deauthorize/:userId', validate(deauthorize), controller.deauthorize.bind(controller));

export default router;
