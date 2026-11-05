import type { Request } from 'express';
import type { VerifiedCallback } from 'passport-jwt';

import c2cJwtExtractor from './c2c-jwt-extractor';
import type { TokenChecker } from './c2c-token-check';

// Largest value of a PostgreSQL `integer`, the type of the user ids
const MAX_USER_ID = 2_147_483_647;

/**
 * Builds the verify callback of a JWT strategy. The user id is the subject of the token, shifted by `idOffset`.
 *
 * With a non-zero offset (tokens of another API sharing this tracking), the subject must be lower than the offset and
 * the shifted id must fit in a `integer`: otherwise the ids of both APIs could overlap.
 *
 * With a checker, the API that issued the token must also confirm it is still valid (not revoked, user not blocked).
 */
export const verifyWithOffset =
  (idOffset: number, checker?: TokenChecker) =>
  (request: Request, payload: unknown, done: VerifiedCallback): void => {
    if (!payload || typeof payload !== 'object' || !('sub' in payload)) {
      return done(null, false);
    }
    const typedPayload = payload as { sub: number | string };
    const sub = typeof typedPayload.sub === 'number' ? typedPayload.sub : Number.parseInt(typedPayload.sub, 10);
    if (idOffset !== 0 && (!Number.isInteger(sub) || sub < 0 || sub >= idOffset || sub + idOffset > MAX_USER_ID)) {
      return done(null, false);
    }
    const user = { id: sub + idOffset };
    if (!checker) {
      return done(null, user);
    }
    const token = c2cJwtExtractor(request);
    if (!token) {
      return done(null, false);
    }
    checker.isValid(token, sub).then(
      (valid) => done(null, valid ? user : false),
      (error: unknown) => done(error, false),
    );
  };

const verify = verifyWithOffset(0);

export default verify;
