import type { Server } from 'node:http';

/*
 * Stops accepting connections and resolves once the requests in progress are answered. Idle keep-alive connections
 * are closed at once; the connections still open after `timeout` ms are closed too.
 */
export const closeServer = (server: Server, timeout: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const force = setTimeout(() => {
      server.closeAllConnections();
    }, timeout);
    force.unref();
    server.close((error) => {
      clearTimeout(force);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
    server.closeIdleConnections();
  });
