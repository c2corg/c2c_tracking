import Router from '@koa/router';

import { controller } from './user.controller.js';

const router = new Router();

router.get('/status', controller.getStatus.bind(controller));

export default router;
