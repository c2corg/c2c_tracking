import type { Middleware } from '@koa/router';
import type { Context } from 'koa';

import { AppError } from '../errors';
import log from '../helpers/logger';
import { promUnhandledErrorsCounter } from '../metrics/prometheus';

export function defaultErrorHandler(): Middleware {
  return async (ctx: Context, next: () => Promise<unknown>): Promise<void> => {
    try {
      await next();
    } catch (error: unknown) {
      if (error instanceof AppError) {
        ctx.status = error.code;
      } else {
        log.warn(error, 'Unhandled error');
        promUnhandledErrorsCounter.inc(1);
        ctx.body = 'Internal Server Error';
        ctx.status = 500;
      }
    }
  };
}
