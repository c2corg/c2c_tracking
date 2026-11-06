import { Router } from 'express';

import { methodNotAllowed } from '../method-not-allowed.ts';

import { controller } from './user.controller.ts';

const router = Router({ mergeParams: true });

router.route('/status').get(controller.getStatus.bind(controller)).all(methodNotAllowed);

export default router;
