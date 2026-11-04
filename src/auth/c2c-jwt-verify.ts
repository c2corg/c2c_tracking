import type { VerifiedCallback } from 'passport-jwt';

// Largest value of a PostgreSQL `integer`, the type of the user ids
const MAX_USER_ID = 2_147_483_647;

/**
 * Builds the verify callback of a JWT strategy. The user id is the subject of the token, shifted by `idOffset`.
 *
 * With a non-zero offset (tokens of another API sharing this tracking), the subject must be lower than the offset and
 * the shifted id must fit in a `integer`: otherwise the ids of both APIs could overlap.
 */
export const verifyWithOffset =
  (idOffset: number) =>
  (payload: unknown, done: VerifiedCallback): void => {
    if (!payload || typeof payload !== 'object' || !('sub' in payload)) {
      return done(null, false);
    }
    const typedPayload = payload as { sub: number | string };
    const sub = typeof typedPayload.sub === 'number' ? typedPayload.sub : Number.parseInt(typedPayload.sub, 10);
    if (idOffset !== 0 && (!Number.isInteger(sub) || sub < 0 || sub >= idOffset || sub + idOffset > MAX_USER_ID)) {
      return done(null, false);
    }
    return done(null, { id: sub + idOffset });
  };

const verify = verifyWithOffset(0);

export default verify;
