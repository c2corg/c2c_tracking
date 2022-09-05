import type { BaseContext } from 'koa';

import config from '../config';

const auth = config.get('server.auth');

export default async function simpleAuth(ctx: BaseContext, next: () => Promise<unknown>): Promise<unknown> {
  if (!auth || ctx.query['token'] === auth) {
    await next();
    return;
  }
  ctx.status = 401;
  ctx.body = { error: 'Auth required' };
  return;
}
