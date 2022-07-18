import type { Context } from 'koa';
import type { IMiddleware } from 'koa-router';

export function logRequest(): IMiddleware {
  return async (ctx: Context, next: () => Promise<unknown>): Promise<void> => {
    const start = Date.now();

    await next();

    const message = `[${ctx.status}] ${ctx.method} ${ctx.path}`;
    const logData = {
      method: ctx.method,
      path: ctx.path,
      statusCode: ctx.status,
      timeMs: Date.now() - start,
    };

    if (ctx.status >= 400) {
      ctx.log.error(message, logData, ctx.body);
    } else {
      ctx.log.info(message, logData);
    }
  };
}
