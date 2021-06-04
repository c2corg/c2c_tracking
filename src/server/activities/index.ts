import Router from 'koa-router';

import { controller } from './controller';

const router = new Router();

router.get('/users/:userId/activities', controller.getUserActivities.bind(controller));
router.get('/users/:userId/activities/:activityId', controller.getUserActivity.bind(controller));

export default router;
