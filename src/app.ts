import cors from '@koa/cors';
import Router from '@koa/router';
import rTracer from 'cls-rtracer';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import helmet from 'koa-helmet';
import logger from 'koa-pino-logger';

import { ensureAuthenticated, ensureUserFromParamsMatchesAuthUser, passport } from './auth';
import config from './config';
import log from './helpers/logger';
import activities from './server/activities';
import { defaultErrorHandler } from './server/error-handler';
import garmin from './server/garmin';
import health from './server/health';
import strava from './server/strava';
import suunto from './server/suunto';
import users from './server/users';

const app = new Koa();
const router = new Router();

router.use('/health', health.routes(), health.allowedMethods());
router.use('/strava', strava.routes(), strava.allowedMethods());
router.use('/suunto', suunto.routes(), suunto.allowedMethods());
router.use('/garmin', garmin.routes(), garmin.allowedMethods());
router.use(
  '/users/:userId/activities',
  ensureAuthenticated,
  ensureUserFromParamsMatchesAuthUser,
  activities.routes(),
  activities.allowedMethods(),
);
router.use(
  '/users/:userId',
  ensureAuthenticated,
  ensureUserFromParamsMatchesAuthUser,
  users.routes(),
  users.allowedMethods(),
);

let logLevel: string;
switch (config.get('env')) {
  case 'production':
    logLevel = 'info';
    break;
  case 'test':
    logLevel = 'warn';
    break;
  default:
    logLevel = 'trace';
}
app
  .use(
    cors({
      allowMethods: ['GET', 'POST'],
      allowHeaders: ['Origin', 'Content-Type', 'Accept', 'Authorization'],
      maxAge: 1728000,
    }),
  )
  .use(bodyParser())
  .use(helmet())
  .use(rTracer.koaMiddleware())
  .use(
    logger({
      logger: log,
      level: logLevel,
    }),
  )
  .use(passport.initialize())
  .use(defaultErrorHandler())
  .use(router.routes())
  .use(router.allowedMethods());

export { app };
