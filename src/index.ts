import type { Server } from 'node:http';

import { app, setShuttingDown } from './app.ts';
import config from './config.ts';
import { database as db } from './db/index.ts';
import { closeServer } from './helpers/close-server.ts';
import log from './helpers/logger.ts';
import { watchMaintenanceFile } from './helpers/maintenance.ts';
import { metricsApp } from './metrics/index.ts';
import { setupWebhooks } from './webhooks.ts';

async function closeGracefully(signal: string, servers: Server[]): Promise<void> {
  log.info(`Received signal to terminate: ${signal}`);

  setShuttingDown(true);

  const shutdown = [...servers.map((server) => closeServer(server, 10_000)), db.closeDatabase()];

  for (const s of shutdown) {
    try {
      await s;
    } catch (e) {
      log.error({ err: e }, 'Error in graceful shutdown');
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
    // eslint-disable-next-line n/no-process-exit -- the process manager restarts the service
    process.exit(1);
  });

  process.once('SIGHUP', () => {
    log.info(`Received event: SIGHUP`);
  });

  watchMaintenanceFile('.', () => {
    setShuttingDown(true);
    log.info('Received signal to switch to maintenance mode');
  });

  try {
    log.info('Apply database migration');
    await db.schemaMigration();

    const servers: Server[] = [];

    const port = config.get('server.port');
    servers.push(
      app.listen(port, () => {
        log.info(`Server is running on port ${port}`);
        setupWebhooks();
      }),
    );
    servers.push(metricsApp.listen(config.get('metrics.port')));

    process.once('SIGINT', (signal: string): void => {
      void closeGracefully(signal, servers);
    });
    process.once('SIGTERM', (signal: string): void => {
      void closeGracefully(signal, servers);
    });
  } catch (err) {
    log.error(err, 'An error occurred while initializing application.');
  }
}

void start();
