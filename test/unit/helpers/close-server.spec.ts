import { createServer, request as httpRequest, Agent, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { closeServer } from '../../../src/helpers/close-server.ts';

// A server whose requests take `delay` ms
const slowServer = async (delay: number): Promise<Server> => {
  const server = createServer((_req, res) => {
    setTimeout(() => res.end('done'), delay);
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  return server;
};

const get = (server: Server, agent?: Agent): Promise<string> =>
  new Promise((resolve, reject) => {
    const { port } = server.address() as AddressInfo;
    httpRequest({ port, agent }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => (body += chunk.toString()));
      res.on('end', () => resolve(body));
    })
      .on('error', reject)
      .end();
  });

describe('closeServer', () => {
  let server: Server | undefined;

  afterEach(() => {
    server?.closeAllConnections();
  });

  it('answers the requests in progress before closing', async () => {
    server = await slowServer(100);
    const response = get(server);
    await new Promise((resolve) => setTimeout(resolve, 20));

    await closeServer(server, 5000);

    await expect(response).resolves.toBe('done');
    expect(server.listening).toBe(false);
  });

  it('closes idle keep-alive connections at once', async () => {
    server = await slowServer(0);
    const agent = new Agent({ keepAlive: true });
    await get(server, agent);
    const start = Date.now();

    await closeServer(server, 5000);

    expect(Date.now() - start).toBeLessThan(1000);
    agent.destroy();
  });

  it('closes the connections still open after the timeout', async () => {
    server = await slowServer(10_000);
    const response = get(server).catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const start = Date.now();

    await closeServer(server, 100);

    expect(Date.now() - start).toBeLessThan(1000);
    expect(await response).toBeInstanceOf(Error);
  });
});
