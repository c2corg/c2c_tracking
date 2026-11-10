import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { http, type HttpError } from '../../../src/helpers/http.ts';
import { createLogger } from '../../../src/helpers/logger.ts';

const SECRETS = ['client-secret-value', 'refresh-token-value', 'basic-password', 'bearer-token-value', 'body-secret'];

// An API that refuses every request
const server: Server = createServer((_req, res) => {
  res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: 'Authorization Error' }));
});
let url: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://localhost:${(server.address() as AddressInfo).port}/oauth/token`;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

// A failed call with a secret in each part of the request
const failedCall = (): Promise<HttpError> =>
  http
    .post(
      `${url}?client_secret=client-secret-value`,
      { client_id: 1, client_secret: 'body-secret' },
      {
        params: { refresh_token: 'refresh-token-value' },
        auth: { username: 'client-id', password: 'basic-password' },
        headers: { 'X-Token': 'Bearer bearer-token-value' },
      },
    )
    .then(
      () => {
        throw new Error('the call should fail');
      },
      (error: unknown) => error as HttpError,
    );

// Logs with a logger writing into a string
const logged = (write: (log: ReturnType<typeof createLogger>) => void): string => {
  let output = '';
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback): void {
      output += chunk.toString();
      callback();
    },
  });
  write(createLogger(destination));
  return output;
};

describe('logger', () => {
  it.each([
    ['as the object', (log: ReturnType<typeof createLogger>, error: HttpError): void => log.warn(error)],
    ['under err', (log: ReturnType<typeof createLogger>, error: HttpError): void => log.warn({ err: error }, 'failed')],
  ])('keeps the secrets of a failed API call out of the logs, when logged %s', async (_label, write) => {
    const error = await failedCall();
    const output = logged((log) => write(log, error));

    for (const secret of SECRETS) {
      expect(output).not.toContain(secret);
    }
    expect(JSON.parse(output)).toMatchObject({
      err: {
        type: 'HttpError',
        message: 'Request failed with status code 401',
        code: 'ERR_BAD_REQUEST',
        method: 'POST',
        url,
        status: 401,
        response: { message: 'Authorization Error' },
      },
    });
  });

  it('still logs other errors with their stack', () => {
    const output = logged((log) => log.warn(new Error('boom')));

    expect(JSON.parse(output)).toMatchObject({
      err: { type: 'Error', message: 'boom', stack: expect.any(String) as unknown },
    });
  });
});
