import { Router } from 'express';

import { methodNotAllowed } from '../method-not-allowed.ts';
import { validate } from '../validator.ts';

import { controller } from './user.controller.ts';
import { status } from './user.validators.ts';

const router = Router({ mergeParams: true });

router.route('/status').get(validate(status), controller.getStatus.bind(controller)).all(methodNotAllowed);

export default router;
