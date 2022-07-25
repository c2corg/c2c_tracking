import Router from 'koa-router';

import { controller } from './controller';

const router = new Router();

router.get('/', controller.getUserActivities.bind(controller));
router.get('/:activityId', controller.getUserActivity.bind(controller));

export default router;
