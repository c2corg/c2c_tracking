import type { Context, Middleware } from 'koa';

const enabledIf: (condition: boolean) => Middleware =
  (condition: boolean) =>
  async (ctx: Context, next: () => Promise<unknown>): Promise<unknown> => {
    if (condition) {
      await next();
      return;
    }
    ctx.throw(405);
  };

export default enabledIf;
