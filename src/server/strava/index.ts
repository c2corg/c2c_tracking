import Router from 'koa-router';

import { validate } from '../validator';

import { StravaController } from './controller';
import { exchangeTokens } from './validators';

const router = new Router();
const controller = new StravaController();

router.get('/exchange_token', validate(exchangeTokens), controller.exchangeTokens.bind(controller));

export default router;
