import Router from '@koa/router';

import { healthService } from '../../health.service';

import HealthController from './health.controller';

const healthController = new HealthController(healthService);
const router = new Router();

router.get('/', healthController.getHealth.bind(healthController));

export default router;
