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

const ensureAuthenticated: Middleware = async (ctx: Context, next: () => Promise<unknown>): Promise<unknown> =>
  passport.authenticate('jwt', { session: false })(ctx, next);

const ensureUserFromParamsMatchesAuthUser: Middleware = async (
  ctx: Context,
  next: () => Promise<unknown>,
): Promise<unknown> => {
  const authenticatedUser: { id: number } | undefined = ctx.state['user'];
  const requiredUser = Number.parseInt(ctx['params'].userId, 10);
  if (authenticatedUser?.id === requiredUser) {
    await next();
    return;
  }
  ctx.status = 403;
  return;
};

passport.use(
  new JwtStrategy(
    {
      secretOrKey: config.get('auth.jwtSecret'),
      jwtFromRequest: ExtractJwt.fromExtractors([c2cJwtExtractor]),
    },
    (payload: unknown, done: VerifiedCallback): void => {
      if (!payload || typeof payload !== 'object' || !('sub' in payload)) {
        return done(null, false);
      }
      const user = { id: (payload as { sub: number }).sub };
      return done(null, user);
    },
  ),
);

export { c2cJwtExtractor, passport, ensureAuthenticated, ensureUserFromParamsMatchesAuthUser };
