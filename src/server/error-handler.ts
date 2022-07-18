import type { Context } from 'koa';
import type { IMiddleware } from 'koa-router';

import { AppError } from '../errors';

export function defaultErrorHandler(): IMiddleware {
  return async (ctx: Context, next: () => Promise<unknown>): Promise<void> => {
    try {
      await next();
    } catch (err) {
      if (err instanceof AppError) {
        ctx.body = err.message;
        ctx.status = err.code ?? 500;
      } else {
        ctx.body = 'Internal Server Error';
        ctx.status = 500;
      }
    }
  };
}
