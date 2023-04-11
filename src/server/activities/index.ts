import Router from '@koa/router';

import { validate } from '../validator.js';

import { controller } from './activity.controller';
import { activities } from './activity.validators';

const router = new Router();

router.get('/', validate(activities), controller.getUserActivities.bind(controller));
router.get('/:activityId/geometry', controller.getUserActivityGeometry.bind(controller));

export default router;
