import Router from 'koa-router';

import { controller } from './controller';

const router = new Router();

router.get('/status', controller.getStatus.bind(controller));

export default router;
