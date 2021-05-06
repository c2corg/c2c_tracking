import { ErrorCallback, retry } from 'async';
import dotenv from 'dotenv';
import Koa from 'koa';
import helmet from 'koa-helmet';
import logger from 'koa-pino-logger';
import Router from 'koa-router';
import { Server } from 'node:http';
import pino from 'pino';

import { defaultErrorHandler } from './error-handler';
import { logRequest } from './log-request';
import health from './health';
import strava from './strava';
import { healthService } from './health.service';
import { Database } from './db';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

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

function registerProcessEvents(server: Server, db: Database): void {
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
    const db = new Database({
      database: process.env.DB_NAME ?? 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT) ?? 5432,
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      debug: process.env.ENV !== 'production',
    });

    log.info('Apply database migration');
    await db.schemaMigration();

    const app = new Koa();
    const router = new Router();

    router.use('/health', health.routes(), health.allowedMethods());
    router.use('/strava', strava.routes(), strava.allowedMethods());

    app
      .use(helmet())
      .use(logger())
      .use(logRequest())
      .use(defaultErrorHandler())
      .use(router.routes())
      .use(router.allowedMethods());
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    registerProcessEvents(server, db);
  } catch (err) {
    log.error(err, 'An error occurred while initializing application.');
  }
}

start();
