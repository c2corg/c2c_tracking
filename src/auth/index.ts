import type { Context, Middleware } from 'koa';
import passport from 'koa-passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';

import config from '../config';
import { ForbiddenError } from '../errors';

import c2cJwtExtractor from './c2c-jwt-extractor';
import verify from './c2c-jwt-verify';

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
  throw new ForbiddenError();
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
