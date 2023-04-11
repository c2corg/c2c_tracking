import type { ServerResponse } from 'http';

import cors from '@koa/cors';
import Router from '@koa/router';
import rTracer from 'cls-rtracer';
import Koa, { type Context } from 'koa';
import bodyParser from 'koa-bodyparser';
import helmet from 'koa-helmet';
import logger from 'koa-pino-logger';
import type { LevelWithSilent } from 'pino';

import { ensureAuthenticated, ensureUserFromParamsMatchesAuthUser, passport } from './auth';
import config from './config.js';
import enabledIf from './helpers/enabled-if.js';
import log from './helpers/logger.js';
import { promResponseTimeSummary } from './metrics/prometheus.js';
import activities from './server/activities';
import coros from './server/coros';
import decathlon from './server/decathlon';
import { defaultErrorHandler } from './server/error-handler.js';
import garmin from './server/garmin';
import health from './server/health';
import polar from './server/polar';
import strava from './server/strava';
import suunto from './server/suunto';
import users from './server/users';

const app = new Koa();
const router = new Router();

router.use('/health', health.routes(), health.allowedMethods());
router.use('/strava', enabledIf(config.get('trackers.strava.enabled')), strava.routes(), strava.allowedMethods());
router.use('/suunto', enabledIf(config.get('trackers.suunto.enabled')), suunto.routes(), suunto.allowedMethods());
router.use('/garmin', enabledIf(config.get('trackers.garmin.enabled')), garmin.routes(), garmin.allowedMethods());
router.use(
  '/decathlon',
  enabledIf(config.get('trackers.decathlon.enabled')),
  decathlon.routes(),
  decathlon.allowedMethods(),
);
router.use('/polar', enabledIf(config.get('trackers.polar.enabled')), polar.routes(), polar.allowedMethods());
router.use('/coros', enabledIf(config.get('trackers.coros.enabled')), coros.routes(), coros.allowedMethods());
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

let logLevel: LevelWithSilent;
switch (config.get('env')) {
  case 'production':
    logLevel = 'info';
    break;
  case 'test':
    logLevel = 'silent';
    break;
  default:
    logLevel = 'trace';
}
app
  .use(async (ctx: Context, next: () => Promise<unknown>): Promise<void> => {
    if (ctx['shuttingDown']) {
      ctx.status = 503;
      ctx.set('Connection', 'close');
      ctx.body = 'Server is shutting down';
    } else {
      await next();
    }
  })
  .use(async (ctx: Context, next: () => Promise<unknown>): Promise<void> => {
    const end = promResponseTimeSummary.labels({ method: ctx.method, name: ctx.path }).startTimer();
    await next();
    end();
  })
  .use(
    cors({
      allowMethods: ['GET', 'POST'],
      allowHeaders: ['Origin', 'Content-Type', 'Accept', 'Authorization'],
      maxAge: 1728000,
      origin: config.get('c2c.frontend.baseUrl').slice(0, -1),
    }),
  )
  .use(
    bodyParser({
      jsonLimit: config.get('server.payload.limit'),
    }),
  )
  .use(helmet())
  .use(rTracer.koaMiddleware())
  .use(
    logger({
      logger: log,
      level: logLevel,
      customLogLevel: (res: ServerResponse, error: Error): LevelWithSilent => {
        if (!error && (res.req?.url === '/health' || res.req?.url?.startsWith('/.well-known/acme-challenge'))) {
          return 'silent';
        }
        return 'info';
      },
    }),
  )
  .use(passport.initialize())
  .use(defaultErrorHandler())
  .use(router.routes())
  .use(router.allowedMethods());

export { app };
