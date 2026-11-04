import type { Context, Middleware } from 'koa';
import passport from 'koa-passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';

import config from '../config';

import c2cJwtExtractor from './c2c-jwt-extractor';
import verify, { verifyWithOffset } from './c2c-jwt-verify';

const jwtSecret = config.get('auth.jwtSecret');
const jwtSecretExtra = config.get('auth.jwtSecretExtra');

if (jwtSecretExtra && jwtSecretExtra === jwtSecret) {
  throw new Error('JWT_SECRET_KEY_EXTRA must be different from JWT_SECRET_KEY');
}

// Passport tries the strategies in order and accepts the first one that validates the token
const strategies = jwtSecretExtra ? ['jwt', 'jwt-extra'] : ['jwt'];

const ensureAuthenticated: Middleware = (ctx: Context, next: () => Promise<unknown>): Promise<unknown> =>
  passport.authenticate(strategies, { session: false })(ctx, next);

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
      secretOrKey: jwtSecret,
      jwtFromRequest: ExtractJwt.fromExtractors([c2cJwtExtractor]),
    },
    verify,
  ),
);

if (jwtSecretExtra) {
  passport.use(
    'jwt-extra',
    new JwtStrategy(
      {
        secretOrKey: jwtSecretExtra,
        jwtFromRequest: ExtractJwt.fromExtractors([c2cJwtExtractor]),
      },
      verifyWithOffset(config.get('auth.jwtExtraIdOffset')),
    ),
  );
}

export { passport, ensureAuthenticated, ensureUserFromParamsMatchesAuthUser };
