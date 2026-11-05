import type { Context, Middleware } from 'koa';
import passport from 'koa-passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';

import config from '../config';
import log from '../helpers/logger';

import c2cJwtExtractor from './c2c-jwt-extractor';
import { verifyWithOffset } from './c2c-jwt-verify';
import { TokenChecker } from './c2c-token-check';

const jwtSecret = config.get('auth.jwtSecret');
const jwtSecretExtra = config.get('auth.jwtSecretExtra');

if (jwtSecretExtra && jwtSecretExtra === jwtSecret) {
  throw new Error('JWT_SECRET_KEY_EXTRA must be different from JWT_SECRET_KEY');
}

// The API that issued the tokens of each secret confirms they are still valid: without it, a token logged out,
// revoked or of a blocked user is accepted until it expires
const checker = (apiBaseUrl: string, name: string): TokenChecker | undefined => {
  if (!apiBaseUrl) {
    log.warn(`No API to check the tokens of ${name}: their signature only is checked`);
    return undefined;
  }
  return new TokenChecker(apiBaseUrl);
};

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
      passReqToCallback: true,
    },
    verifyWithOffset(0, checker(config.get('c2c.api.baseUrl'), 'JWT_SECRET_KEY')),
  ),
);

if (jwtSecretExtra) {
  passport.use(
    'jwt-extra',
    new JwtStrategy(
      {
        secretOrKey: jwtSecretExtra,
        jwtFromRequest: ExtractJwt.fromExtractors([c2cJwtExtractor]),
        passReqToCallback: true,
      },
      verifyWithOffset(
        config.get('auth.jwtExtraIdOffset'),
        checker(config.get('c2c.api.extraBaseUrl'), 'JWT_SECRET_KEY_EXTRA'),
      ),
    ),
  );
}

export { passport, ensureAuthenticated, ensureUserFromParamsMatchesAuthUser };
