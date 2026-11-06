import { Router } from 'express';

import { healthService } from '../../health.service.ts';
import { methodNotAllowed } from '../method-not-allowed.ts';

import HealthController from './health.controller.ts';

const healthController = new HealthController(healthService);
const router = Router();

router.route('/').get(healthController.getHealth.bind(healthController)).all(methodNotAllowed);

export default router;
