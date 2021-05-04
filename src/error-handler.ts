import { Context } from 'koa';
import { IMiddleware } from 'koa-router';

export function defaultErrorHandler(): IMiddleware {
  return async (ctx: Context, next: () => Promise<any>) => {
    try {
      await next();
    } catch (err) {
      ctx.log.error('Error handler:', err);
      ctx.body = 'Internal Server Error';
      ctx.status = 500;
    }
  };
}
