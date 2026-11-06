import { Router } from 'express';

import { database } from '../../db/index.ts';
import { healthService } from '../../health.service.ts';
import { methodNotAllowed } from '../method-not-allowed.ts';
import { noInput, validate } from '../validator.ts';

import HealthController from './health.controller.ts';

const healthController = new HealthController(healthService, database);
const router = Router();

router.route('/').get(validate(noInput), healthController.getHealth.bind(healthController)).all(methodNotAllowed);
router
  .route('/ready')
  .get(validate(noInput), healthController.getReadiness.bind(healthController))
  .all(methodNotAllowed);

export default router;
