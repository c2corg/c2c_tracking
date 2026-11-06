import { Writable } from 'stream';

import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';

import { createLogger } from '../../../src/helpers/logger';

const SECRETS = ['client-secret-value', 'refresh-token-value', 'basic-password', 'bearer-token-value', 'body-secret'];

const failedCall = (): AxiosError => {
  const config: InternalAxiosRequestConfig = {
    method: 'post',
    url: 'https://api.example.org/oauth/token?client_secret=client-secret-value',
    params: { client_secret: 'client-secret-value', refresh_token: 'refresh-token-value' },
    auth: { username: 'client-id', password: 'basic-password' },
    headers: new AxiosHeaders({ Authorization: 'Bearer bearer-token-value' }),
    data: 'client_id=1&client_secret=body-secret',
  };
  return new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, undefined, {
    status: 401,
    statusText: 'Unauthorized',
    data: { message: 'Authorization Error' },
    headers: {},
    config,
  });
};

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
    ['as the object', (log: ReturnType<typeof createLogger>): void => log.warn(failedCall())],
    ['under err', (log: ReturnType<typeof createLogger>): void => log.warn({ err: failedCall() }, 'failed')],
  ])('keeps the secrets of a failed API call out of the logs, when logged %s', (_label, write) => {
    const output = logged(write);

    for (const secret of SECRETS) {
      expect(output).not.toContain(secret);
    }
    expect(JSON.parse(output)).toMatchObject({
      err: {
        type: 'AxiosError',
        message: 'Request failed with status code 401',
        code: 'ERR_BAD_REQUEST',
        method: 'post',
        url: 'https://api.example.org/oauth/token',
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
