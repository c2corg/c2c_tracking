import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { http, HttpError, isHttpError } from '../../../src/helpers/http.ts';

type Echo = { method: string | undefined; url: string | undefined; headers: IncomingHttpHeaders; body: string };

// Echoes the request as JSON, except on a few paths
const server: Server = createServer((req, res) => {
  let body = '';
  req.on('data', (chunk: Buffer) => (body += chunk.toString()));
  req.on('end', () => {
    if (req.url?.startsWith('/status/')) {
      res.writeHead(Number.parseInt(req.url.slice('/status/'.length), 10), { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'nope' }));
    } else if (req.url === '/text') {
      res.end('oauth_token=a&oauth_token_secret=b');
    } else if (req.url === '/binary') {
      res.end(Buffer.from([1, 2, 3]));
    } else if (req.url === '/empty') {
      res.writeHead(204).end();
    } else if (req.url === '/slow') {
      setTimeout(() => res.end('late'), 500);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ method: req.method, url: req.url, headers: req.headers, body } satisfies Echo));
    }
  });
});
let base: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

describe('http', () => {
  it('gets JSON, with query parameters and headers', async () => {
    const { status, data } = await http.get<Echo>(`${base}/a?x=1`, {
      params: { y: 'two words', z: 3, skipped: undefined },
      headers: { Authorization: 'Bearer token' },
    });

    expect(status).toBe(200);
    expect(data.method).toBe('GET');
    expect(data.url).toBe('/a?x=1&y=two+words&z=3');
    expect(data.headers['authorization']).toBe('Bearer token');
  });

  it('posts JSON objects', async () => {
    const { data } = await http.post<Echo>(`${base}/a`, { a: 1 });

    expect(data.headers['content-type']).toBe('application/json');
    expect(JSON.parse(data.body)).toEqual({ a: 1 });
  });

  it('posts forms, from URLSearchParams or fields', async () => {
    const first = await http.post<Echo>(`${base}/a`, new URLSearchParams({ a: '1', b: 'x y' }));
    const second = await http.postForm<Echo>(`${base}/a`, { grant_type: 'refresh_token' });

    expect(first.data.headers['content-type']).toMatch(/^application\/x-www-form-urlencoded/);
    expect(first.data.body).toBe('a=1&b=x+y');
    expect(second.data.body).toBe('grant_type=refresh_token');
  });

  it('posts without body', async () => {
    const { data } = await http.post<Echo>(`${base}/a`, null, { params: { code: 'c' } });

    expect(data.body).toBe('');
    expect(data.url).toBe('/a?code=c');
  });

  it('sends basic authentication', async () => {
    const { data } = await http.delete<Echo>(`${base}/a`, { auth: { username: 'id', password: 'secret' } });

    expect(data.method).toBe('DELETE');
    expect(data.headers['authorization']).toBe(`Basic ${Buffer.from('id:secret').toString('base64')}`);
  });

  it('gives text that is not JSON as is, binary data as an ArrayBuffer, and an empty string without body', async () => {
    expect((await http.post(`${base}/text`)).data).toBe('oauth_token=a&oauth_token_secret=b');
    const binary = await http.get<ArrayBuffer>(`${base}/binary`, { responseType: 'arraybuffer' });
    expect(binary.data).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(binary.data)]).toEqual([1, 2, 3]);
    expect(await http.get(`${base}/empty`)).toEqual({ status: 204, data: '' });
    expect((await http.get(`${base}/a`, { responseType: 'text' })).data).toMatch(/^\{"method":"GET"/);
  });

  it('throws on statuses outside 2xx, with the status and body but not the query', async () => {
    const error = await http
      .get(`${base}/status/401`, { params: { client_secret: 'secret' } })
      .catch((e: unknown) => e);

    expect(isHttpError(error)).toBe(true);
    expect(error).toMatchObject({
      message: 'Request failed with status code 401',
      method: 'GET',
      url: `${base}/status/401`,
      status: 401,
      code: 'ERR_BAD_REQUEST',
      data: { message: 'nope' },
    });
    expect(JSON.stringify(error)).not.toContain('secret');
  });

  it('accepts other statuses when asked', async () => {
    const { status } = await http.get(`${base}/status/403`, { validateStatus: () => true });

    expect(status).toBe(403);
  });

  it('throws when there is no answer, or too late', async () => {
    // a port nothing listens on
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, resolve));
    const { port } = closed.address() as AddressInfo;
    await new Promise((resolve) => closed.close(resolve));
    await expect(http.get(`http://127.0.0.1:${port}/`)).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    await expect(http.get(`${base}/slow`, { timeout: 50 })).rejects.toMatchObject({ code: 'ETIMEDOUT' });
    await expect(http.get(`${base}/slow`, { timeout: 50 })).rejects.toBeInstanceOf(HttpError);
  });
});
