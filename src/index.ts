import './dotenv'; // eslint-disable-line import/order

import { ErrorCallback, retry } from 'async'; // eslint-disable-line import/order

import type { Server } from 'http'; // eslint-disable-line import/order

import cors from '@koa/cors';
import Router from '@koa/router';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import helmet from 'koa-helmet';
import logger from 'koa-pino-logger';
import pino from 'pino';

import { database as db } from './db';
import { healthService } from './health.service';
import { checkEnvvars } from './helpers/envar';
import activities from './server/activities';
import { defaultErrorHandler } from './server/error-handler';
import garmin from './server/garmin';
import health from './server/health';
import strava from './server/strava';
import { stravaService } from './server/strava/service';
import suunto from './server/suunto';
import users from './server/users';

const PORT = Number(process.env['PORT']) || 80;

const log = pino();

async function closeServer(server: Server): Promise<void> {
  const checkPendingRequests = (callback: ErrorCallback<Error | undefined>): void => {
    server.getConnections((err: Error | null, pendingRequests: number) => {
      if (err) {
        callback(err);
      } else if (pendingRequests) {
        callback(Error(`Number of pending requests: ${pendingRequests}`));
      } else {
        callback(undefined);
      }
    });
  };

  return new Promise<void>((resolve, reject) => {
    retry({ times: 10, interval: 1000 }, checkPendingRequests, (error?: Error | null) => {
      if (error) {
        server.close(() => reject(error));
      } else {
        server.close(() => resolve());
      }
    });
  });
}

function registerProcessEvents(server: Server): void {
  process.on('uncaughtException', (error: Error) => {
    log.error('UncaughtException', error);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    log.info(reason as Record<string, unknown>);
  });

  process.on('SIGTERM', async () => {
    log.info('Starting graceful shutdown');

    healthService.setShuttingDown();

    let exitCode = 0;
    const shutdown = [closeServer(server), db.closeDatabase()];

    for (const s of shutdown) {
      try {
        await s;
      } catch (e) {
        log.error('Error in graceful shutdown ', e);
        exitCode = 1;
      }
    }

    process.exit(exitCode);
  });
}

export async function start(): Promise<void> {
  checkEnvvars('SERVER_BASE_URL', 'FRONTEND_BASE_URL', 'FRONTEND_SUBSCRIPTION_URL');
  try {
    log.info('Apply database migration');
    await db.schemaMigration();

    const app = new Koa();
    const router = new Router();

    router.use('/health', health.routes(), health.allowedMethods());
    router.use('/strava', strava.routes(), strava.allowedMethods());
    router.use('/suunto', suunto.routes(), suunto.allowedMethods());
    router.use('/garmin', garmin.routes(), garmin.allowedMethods());
    router.use('/users/:userId/activities', activities.routes(), activities.allowedMethods());
    router.use('/users/:userId', users.routes(), users.allowedMethods());

    app
      .use(cors())
      .use(bodyParser())
      .use(helmet())
      .use(
        logger({
          level: process.env['ENV'] !== 'production' ? 'trace' : 'info',
        }),
      )
      .use(defaultErrorHandler())
      .use(router.routes())
      .use(router.allowedMethods());
    const server = app.listen(PORT, () => {
      log.info(`Server is running on port ${PORT}`);
      stravaService.setupWebhook();
    });

    registerProcessEvents(server);
  } catch (err) {
    log.error(err, 'An error occurred while initializing application.');
  }
}

start();
