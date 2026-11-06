import type { ServerResponse } from 'http';

import cors from '@koa/cors';
import Router from '@koa/router';
import rTracer from 'cls-rtracer';
import type { Context } from 'koa';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import helmet from 'koa-helmet';
import logger from 'koa-pino-logger';
import type { LevelWithSilent } from 'pino';

import { ensureAuthenticated, ensureUserFromParamsMatchesAuthUser, passport } from './auth/index.ts';
import config from './config.ts';
import { corsOrigin } from './helpers/cors-origin.ts';
import enabledIf from './helpers/enabled-if.ts';
import log from './helpers/logger.ts';
import { promResponseTimeSummary } from './metrics/prometheus.ts';
import activities from './server/activities/index.ts';
import coros from './server/coros/index.ts';
import decathlon from './server/decathlon/index.ts';
import { defaultErrorHandler } from './server/error-handler.ts';
import garmin from './server/garmin/index.ts';
import health from './server/health/index.ts';
import polar from './server/polar/index.ts';
import strava from './server/strava/index.ts';
import suunto from './server/suunto/index.ts';
import users from './server/users/index.ts';

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
      origin: corsOrigin(config.get('c2c.frontend.baseUrl'), config.get('c2c.frontend.extraOrigins')),
    }),
  )
  .use(
    bodyParser({
      jsonLimit: config.get('server.payload.limit'),
    }),
  )
  // koa-helmet declares an ES default export, but its CommonJS module.exports is the middleware factory itself
  .use((helmet as unknown as typeof helmet.default)())
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
