import Router from '@koa/router';

import { healthService } from '../../health.service.ts';

import HealthController from './health.controller.ts';

const healthController = new HealthController(healthService);
const router = new Router();

router.get('/', healthController.getHealth.bind(healthController));

export default router;
