import type { Request } from 'express';
import type { Context, Middleware } from 'koa';
import passport from 'koa-passport';
import { ExtractJwt, Strategy as JwtStrategy, VerifiedCallback } from 'passport-jwt';

import config from '../config';

const c2cJwtExtractor = (request: Request): string | null => {
  const authHeader = request.headers['authorization'];
  if (typeof authHeader !== 'string') {
    return null;
  }
  const found = /JWT token="([\w-\.]+)"/.exec(authHeader);
  if (!found || found.length < 2) {
    return null;
  }
  return found[1] ?? null;
};

passport.use(
  new JwtStrategy(
    {
      secretOrKey: config.get('auth.jwtSecret'),
      jwtFromRequest: ExtractJwt.fromExtractors([c2cJwtExtractor]),
    },
    (payload: unknown, done: VerifiedCallback): void => {
      if (!payload || typeof payload !== 'object' || !('sub' in payload)) {
        return done('Invalid token', false);
      }
      const user = (payload as { sub: number }).sub;
      return done(null, user);
    },
  ),
);

const ensureAuthenticated: Middleware = async (ctx: Context, next: () => Promise<unknown>): Promise<unknown> =>
  passport.authenticate('jwt', { session: false })(ctx, next);

const ensureUserFromParams: Middleware = async (ctx: Context, next: () => Promise<unknown>): Promise<unknown> => {
  const authenticatedUser: number = ctx.state['user'];
  const requiredUser = Number.parseInt(ctx['params'].userId, 10);
  if (authenticatedUser === requiredUser) {
    await next();
    return;
  }
  ctx.status = 403;
  return;
};

export { passport, ensureAuthenticated, ensureUserFromParams };
