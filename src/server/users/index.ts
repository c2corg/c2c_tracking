import Router from '@koa/router';

import simpleAuth from '../../helpers/simple-auth';

import { controller } from './controller';

const router = new Router();

router.use(simpleAuth);

router.get('/status', controller.getStatus.bind(controller));

export default router;
