import { STATUS_CODES } from 'node:http';

import type { ErrorRequestHandler } from 'express';
import { isHttpError } from 'http-errors';

import { AppError } from '../errors.ts';
import log from '../helpers/logger.ts';
import { promUnhandledErrorsCounter } from '../metrics/prometheus.ts';

// Errors are answered as plain text: the body of application errors, the message of HTTP errors (the frontend
// translates some of them, e.g. setup-failed), a generic message for anything else
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  res.type('text/plain');
  if (error instanceof AppError) {
    res.status(error.code).send(error.body ?? STATUS_CODES[error.code]);
  } else if (isHttpError(error)) {
    res.status(error.status).send(error.message);
  } else {
    log.warn(error, 'Unhandled error');
    promUnhandledErrorsCounter.inc(1);
    res.status(500).send('Internal Server Error');
  }
};
