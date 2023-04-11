import type { Context, Middleware } from 'koa';
import passport from 'koa-passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';

import config from '../config.js';

import c2cJwtExtractor from './c2c-jwt-extractor.js';
import verify from './c2c-jwt-verify.js';

const ensureAuthenticated: Middleware = (ctx: Context, next: () => Promise<unknown>): Promise<unknown> =>
  passport.authenticate('jwt', { session: false })(ctx, next);

const ensureUserFromParamsMatchesAuthUser: Middleware = async (
  ctx: Context,
  next: () => Promise<unknown>,
): Promise<unknown> => {
  const authenticatedUser: { id: number } | undefined = ctx.state['user'] as { id: number } | undefined;
  const requiredUser = Number.parseInt((ctx['params'] as { userId: string }).userId, 10);
  if (authenticatedUser?.id === requiredUser) {
    await next();
    return;
  }
  ctx.throw(403);
};

passport.use(
  new JwtStrategy(
    {
      secretOrKey: config.get('auth.jwtSecret'),
      jwtFromRequest: ExtractJwt.fromExtractors([c2cJwtExtractor]),
    },
    verify,
  ),
);

export { passport, ensureAuthenticated, ensureUserFromParamsMatchesAuthUser };
