import Router from '@koa/router';

import { validate } from '../validator.ts';

import { controller } from './activity.controller.ts';
import { activities } from './activity.validators.ts';

const router = new Router();

router.get('/', validate(activities), controller.getUserActivities.bind(controller));
router.get('/:activityId/geometry', controller.getUserActivityGeometry.bind(controller));

export default router;
