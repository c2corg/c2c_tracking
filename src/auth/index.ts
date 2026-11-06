import type { RequestHandler } from 'express';
import createHttpError from 'http-errors';
import passport from 'passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';

import config from '../config.ts';
import log from '../helpers/logger.ts';

import c2cJwtExtractor from './c2c-jwt-extractor.ts';
import { verifyWithOffset } from './c2c-jwt-verify.ts';
import { TokenChecker } from './c2c-token-check.ts';

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

const ensureAuthenticated: RequestHandler = passport.authenticate(strategies, { session: false }) as RequestHandler;

const ensureUserFromParamsMatchesAuthUser: RequestHandler = (req, _res, next) => {
  const authenticatedUser = req.user as { id: number } | undefined;
  const requiredUser = Number.parseInt(req.params['userId'] ?? '', 10);
  next(authenticatedUser?.id === requiredUser ? undefined : createHttpError(403));
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
