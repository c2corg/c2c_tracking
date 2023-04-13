import Router from '@koa/router';

import { healthService } from '../../health.service.js';

import HealthController from './health.controller.js';

const healthController = new HealthController(healthService);
const router = new Router();

router.get('/', healthController.getHealth.bind(healthController));

export default router;
