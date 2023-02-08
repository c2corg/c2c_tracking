import './dotenv';

import type { Server } from 'http';

import { ErrorCallback, retry } from 'async';
import watch from 'node-watch';

import { app } from './app';
import config from './config';
import { database as db } from './db';
import log from './helpers/logger';
import { metricsServer } from './metrics';
import { polarService } from './server/polar/polar.service';
import { stravaService } from './server/strava/strava.service';

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

async function closeGracefully(signal: string, server: Server): Promise<void> {
  log.info(`Received signal to terminate: ${signal}`);

  app.context['shuttingDown'] = true;

  const shutdown = [closeServer(server), db.closeDatabase(), metricsServer.close()];

  for (const s of shutdown) {
    try {
      await s;
    } catch (e) {
      log.error('Error in graceful shutdown ', e);
    }
  }

  process.kill(process.pid, signal);
}

export async function start(): Promise<void> {
  process.on('unhandledRejection', (reason: string) => {
    // I just caught an unhandled promise rejection,
    // since we already have fallback handler for unhandled errors (see below),
    // let throw and let him handle that
    throw new Error(reason);
  });

  process.on('uncaughtException', (error: Error) => {
    // I just received an error that was never handled, time to handle it and then decide whether a restart is needed
    log.error(error);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  });

  process.once('SIGHUP', () => {
    log.info(`Received event: SIGHUP`);
  });

  watch('./', { filter: /maintenance_mode\.txt$/ }, (eventType) => {
    if (eventType === 'update') {
      app.context['shuttingDown'] = true;
      log.info('Received signal to switch to maintenance mode');
    }
  });

  try {
    log.info('Apply database migration');
    await db.schemaMigration();

    const port = config.get('server.port');
    const server = app.listen(port, () => {
      log.info(`Server is running on port ${port}`);
      stravaService.setupWebhook();
      polarService.setupWebhook();
    });

    // Export metrics for prometheus
    metricsServer.listen(config.get('metrics.port'));

    process.once('SIGINT', async (signal: string) => closeGracefully(signal, server));
    process.once('SIGTERM', async (signal: string) => closeGracefully(signal, server));
  } catch (err) {
    log.error(err, 'An error occurred while initializing application.');
  }
}

start();
