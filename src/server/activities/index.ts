import { Router } from 'express';

import { methodNotAllowed } from '../method-not-allowed.ts';
import { validate } from '../validator.ts';

import { controller } from './activity.controller.ts';
import { activities, geometry } from './activity.validators.ts';

const router = Router({ mergeParams: true });

router.route('/').get(validate(activities), controller.getUserActivities.bind(controller)).all(methodNotAllowed);
router
  .route('/:activityId/geometry')
  .get(validate(geometry), controller.getUserActivityGeometry.bind(controller))
  .all(methodNotAllowed);

export default router;
