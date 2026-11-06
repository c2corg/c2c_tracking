import type { Server } from 'node:http';

import supertest from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { app, setShuttingDown } from '../../src/app.ts';
import { AppError, NotFoundError } from '../../src/errors.ts';
import { healthService } from '../../src/health.service.ts';
import log from '../../src/helpers/logger.ts';
import { currentRequestId } from '../../src/helpers/request-id.ts';
import { promUnhandledErrorsCounter } from '../../src/metrics/prometheus.ts';

// The HTTP behaviour of the whole application (middlewares, routing, errors), independent of the web framework
describe('Application', () => {
  let server: Server;
  let request: ReturnType<typeof supertest>;

  beforeAll(() => {
    server = app.listen();
    request = supertest(server);
  });

  afterAll(() => {
    server.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setShuttingDown(false);
  });

  describe('routing', () => {
    it('answers 404 to an unknown path', async () => {
      const response = await request.get('/unknown');

      expect(response.status).toBe(404);
    });

    it('answers 405 to a known path with another method, with the allowed methods', async () => {
      const response = await request.put('/health');

      expect(response.status).toBe(405);
      expect(response.headers['allow']).toMatch(/\bGET\b/);
    });

    it('answers HEAD requests of GET routes', async () => {
      const response = await request.head('/health');

      expect(response.status).toBe(200);
    });
  });

  describe('maintenance and shutdown', () => {
    it('answers 503 and closes the connection', async () => {
      setShuttingDown(true);

      const response = await request.get('/health');

      expect(response.status).toBe(503);
      expect(response.text).toBe('Server is shutting down');
      expect(response.headers['connection']).toBe('close');
    });
  });

  describe('CORS', () => {
    it('answers the preflight of the frontend', async () => {
      const response = await request
        .options('/users/1/activities')
        .set('Origin', 'http://localhost:8080')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8080');
      expect(response.headers['access-control-allow-methods']).toBe('GET,POST');
      expect(response.headers['access-control-allow-headers']).toBe('Origin,Content-Type,Accept,Authorization');
      expect(response.headers['access-control-max-age']).toBe('1728000');
      expect(response.headers['vary']).toMatch(/\bOrigin\b/);
    });

    it('allows the frontend origin on requests', async () => {
      const response = await request.get('/health').set('Origin', 'http://localhost:8080');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8080');
    });

    it('answers another origin with the frontend origin, which the browser refuses', async () => {
      const response = await request
        .options('/users/1/activities')
        .set('Origin', 'https://other.example.org')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8080');
    });
  });

  describe('security headers', () => {
    it('sets the usual security headers', async () => {
      const response = await request.get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['strict-transport-security']).toMatch(/^max-age=\d+/);
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['content-security-policy']).toMatch(/default-src 'self'/);
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('body parsing', () => {
    it('answers 400 to invalid JSON', async () => {
      vi.spyOn(log, 'info').mockImplementation(() => undefined);

      const response = await request.post('/strava/webhook').set('Content-Type', 'application/json').send('{"a":');

      expect(response.status).toBe(400);
    });

    it('does not parse other content types', async () => {
      vi.spyOn(log, 'info').mockImplementation(() => undefined);
      vi.spyOn(log, 'warn').mockImplementation(() => undefined);

      const response = await request.post('/strava/webhook').set('Content-Type', 'text/plain').send('hello');

      expect(response.status).toBe(400);
      expect(response.text).toMatch(/"_errors"/);
    });
  });

  describe('errors', () => {
    it('answers the status and body of application errors, as text', async () => {
      vi.spyOn(log, 'warn').mockImplementation(() => undefined);
      vi.spyOn(healthService, 'getStatus').mockImplementation(() => {
        throw new NotFoundError('not found', undefined, 'details');
      });

      const response = await request.get('/health');

      expect(response.status).toBe(404);
      expect(response.text).toBe('details');
      expect(response.headers['content-type']).toMatch(/^text\/plain/);
    });

    it('answers application errors without body with the status text', async () => {
      vi.spyOn(log, 'warn').mockImplementation(() => undefined);
      vi.spyOn(healthService, 'getStatus').mockImplementation(() => {
        throw new NotFoundError('not found');
      });

      const response = await request.get('/health');

      expect(response.status).toBe(404);
      expect(response.text).toBe('Not Found');
      expect(response.headers['content-type']).toMatch(/^text\/plain/);
    });

    it('answers validation errors with their details, as JSON text', async () => {
      vi.spyOn(log, 'info').mockImplementation(() => undefined);
      vi.spyOn(log, 'warn').mockImplementation(() => undefined);

      const response = await request.post('/strava/webhook').send({});

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toMatch(/^text\/plain/);
      expect(JSON.parse(response.text)).toMatchObject({ object_type: { _errors: [expect.any(String)] } });
    });

    it('answers HTTP errors with their message', async () => {
      vi.spyOn(log, 'warn').mockImplementation(() => undefined);
      vi.spyOn(healthService, 'getStatus').mockImplementation(() => {
        throw new AppError(418, 'teapot');
      });

      const response = await request.get('/health');

      expect(response.status).toBe(418);
    });

    it('answers 500 to unexpected errors, without details, and counts them', async () => {
      vi.spyOn(log, 'warn').mockImplementation(() => undefined);
      vi.spyOn(healthService, 'getStatus').mockImplementation(() => {
        throw new Error('secret details');
      });
      const before = (await promUnhandledErrorsCounter.get()).values[0]?.value ?? 0;

      const response = await request.get('/health');

      expect(response.status).toBe(500);
      expect(response.text).toBe('Internal Server Error');
      expect((await promUnhandledErrorsCounter.get()).values[0]?.value).toBe(before + 1);
    });
  });

  describe('request id', () => {
    it('gives each request its own id, available to the logs', async () => {
      const ids: (string | undefined)[] = [];
      vi.spyOn(healthService, 'getStatus').mockImplementation(() => {
        ids.push(currentRequestId());
        return {} as ReturnType<typeof healthService.getStatus>;
      });

      await request.get('/health');
      await request.get('/health');

      expect(ids).toHaveLength(2);
      expect(ids[0]).toEqual(expect.any(String));
      expect(ids[1]).toEqual(expect.any(String));
      expect(ids[0]).not.toBe(ids[1]);
      expect(currentRequestId()).toBeUndefined();
    });
  });
});
