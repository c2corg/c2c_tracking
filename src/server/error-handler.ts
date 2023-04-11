import type { Middleware } from '@koa/router';
import { type Context, HttpError } from 'koa';

import { AppError } from '../errors.js';
import log from '../helpers/logger.js';
import { promUnhandledErrorsCounter } from '../metrics/prometheus.js';

export function defaultErrorHandler(): Middleware {
  return async (ctx: Context, next: () => Promise<unknown>): Promise<void> => {
    try {
      await next();
    } catch (error: unknown) {
      if (error instanceof AppError) {
        ctx.body = error.body;
        ctx.status = error.code;
      } else if (error instanceof HttpError) {
        ctx.body = error.message;
        ctx.status = error.status;
      } else {
        log.warn(error, 'Unhandled error');
        promUnhandledErrorsCounter.inc(1);
        ctx.body = 'Internal Server Error';
        ctx.status = 500;
      }
    }
  };
}
