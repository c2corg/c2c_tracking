import type { IncomingMessage, ServerResponse } from 'node:http';

import cors from 'cors';
import express, { type Request, type RequestHandler } from 'express';
import helmet from 'helmet';
import createHttpError from 'http-errors';
import type { LevelWithSilent } from 'pino';
import { pinoHttp } from 'pino-http';

import { ensureAuthenticated, ensureUserFromParamsMatchesAuthUser, passport, userRateLimit } from './auth/index.ts';
import config from './config.ts';
import { corsOrigin } from './helpers/cors-origin.ts';
import enabledIf from './helpers/enabled-if.ts';
import log from './helpers/logger.ts';
import { currentRequestId, requestId } from './helpers/request-id.ts';
import { promResponseTimeSummary } from './metrics/prometheus.ts';
import activities from './server/activities/index.ts';
import coros from './server/coros/index.ts';
import decathlon from './server/decathlon/index.ts';
import { errorHandler } from './server/error-handler.ts';
import garmin from './server/garmin/index.ts';
import health from './server/health/index.ts';
import polar from './server/polar/index.ts';
import strava from './server/strava/index.ts';
import suunto from './server/suunto/index.ts';
import users from './server/users/index.ts';

let shuttingDown = false;

// Maintenance mode or shutdown: the application then answers 503 to every request
const setShuttingDown = (value: boolean): void => {
  shuttingDown = value;
};

const rejectWhenShuttingDown: RequestHandler = (_req, res, next) => {
  if (shuttingDown) {
    res.set('Connection', 'close').type('text/plain').status(503).send('Server is shutting down');
    return;
  }
  next();
};

// The route pattern of a request, e.g. /users/:userId/activities, 'unmatched' when no route matched
const routePattern = (req: Request): string => {
  const route = req.route as { path: string } | undefined;
  if (!route) {
    return 'unmatched';
  }
  // the base URL of mounted routers has the values of their parameters
  let base = req.baseUrl;
  for (const [name, value] of Object.entries(req.params)) {
    base = base.replace(`/${value}`, `/:${name}`);
  }
  return route.path === '/' ? base || '/' : base + route.path;
};

// Response times by route pattern (not by path, whose ids would make one series per user)
const measureResponseTime: RequestHandler = (req, res, next) => {
  const end = promResponseTimeSummary.startTimer();
  res.on('finish', () => {
    end({ method: req.method, name: routePattern(req) });
  });
  next();
};

// The level of the log of a request: none in the tests, nor for the health and readiness checks and the ACME challenges that
// succeed (the URL is the original one: routers rewrite req.url)
const silentRequestLogs = config.get('env') === 'test';
export const requestLogLevel = (url: string, error: unknown): LevelWithSilent =>
  silentRequestLogs ||
  (!error && (url === '/health' || url === '/health/ready' || url.startsWith('/.well-known/acme-challenge')))
    ? 'silent'
    : 'info';

const app = express();

app.use(rejectWhenShuttingDown);
app.use(measureResponseTime);
app.use(helmet());
app.use(
  cors({
    methods: ['GET', 'POST'],
    allowedHeaders: ['Origin', 'Content-Type', 'Accept', 'Authorization'],
    maxAge: 1728000,
    origin: corsOrigin(config.get('c2c.frontend.baseUrl'), config.get('c2c.frontend.extraOrigins')),
  }),
);
app.use(
  express.json({
    limit: config.get('server.payload.limit'),
    // keep the body as received: the signature of Polar webhooks covers it
    verify: (req: IncomingMessage & { rawBody?: string }, _res: ServerResponse, buffer: Buffer) => {
      req.rawBody = buffer.toString('utf8');
    },
  }),
);
app.use(express.urlencoded({ extended: false }));
app.use(requestId);
app.use(
  pinoHttp({
    logger: log,
    genReqId: () => currentRequestId() ?? '',
    customLogLevel: (req, _res, error) => requestLogLevel((req as Request).originalUrl, error),
  }),
);
app.use(passport.initialize());

app.use('/health', health);
app.use('/strava', enabledIf(config.get('trackers.strava.enabled')), strava);
app.use('/suunto', enabledIf(config.get('trackers.suunto.enabled')), suunto);
app.use('/garmin', enabledIf(config.get('trackers.garmin.enabled')), garmin);
app.use('/decathlon', enabledIf(config.get('trackers.decathlon.enabled')), decathlon);
app.use('/polar', enabledIf(config.get('trackers.polar.enabled')), polar);
app.use('/coros', enabledIf(config.get('trackers.coros.enabled')), coros);
app.use(
  '/users/:userId/activities',
  ensureAuthenticated,
  ensureUserFromParamsMatchesAuthUser,
  userRateLimit,
  activities,
);
app.use('/users/:userId', ensureAuthenticated, ensureUserFromParamsMatchesAuthUser, userRateLimit, users);

app.use((_req, _res, next) => {
  next(createHttpError(404));
});
app.use(errorHandler);

export { app, setShuttingDown };
