import dotenv from 'dotenv'; // eslint-disable-line import/order

if (process.env.NODE_ENV !== 'PRODUCTION') {
  dotenv.config();
}

import { ErrorCallback, retry } from 'async'; // eslint-disable-line import/order

import { Server } from 'http'; // eslint-disable-line import/order

import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import helmet from 'koa-helmet';
import logger from 'koa-pino-logger';
import Router from 'koa-router';
import pino from 'pino';

import { database as db } from './db';
import { healthService } from './health.service';
import activities from './server/activities';
import { defaultErrorHandler } from './server/error-handler';
import health from './server/health';
import { logRequest } from './server/log-request';
import strava from './server/strava';

const PORT = Number(process.env.PORT) ?? 80;

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
  try {
    log.info('Apply database migration');
    await db.schemaMigration();

    const app = new Koa();
    const router = new Router();

    router.use('/health', health.routes(), health.allowedMethods());
    router.use('/strava', strava.routes(), strava.allowedMethods());
    router.use('/toto', activities.routes(), activities.allowedMethods());

    app
      .use(bodyParser())
      .use(helmet())
      .use(logger())
      .use(logRequest())
      .use(defaultErrorHandler())
      .use(router.routes())
      .use(router.allowedMethods());
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    registerProcessEvents(server);
  } catch (err) {
    log.error(err, 'An error occurred while initializing application.');
  }
}

start();
