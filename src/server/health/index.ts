import { Router } from 'express';

import { healthService } from '../../health.service.ts';
import { methodNotAllowed } from '../method-not-allowed.ts';
import { noInput, validate } from '../validator.ts';

import HealthController from './health.controller.ts';

const healthController = new HealthController(healthService);
const router = Router();

router.route('/').get(validate(noInput), healthController.getHealth.bind(healthController)).all(methodNotAllowed);

export default router;
