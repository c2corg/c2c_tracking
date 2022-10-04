import type { VerifiedCallback } from 'passport-jwt';

const verify = (payload: unknown, done: VerifiedCallback): void => {
  if (!payload || typeof payload !== 'object' || !('sub' in payload)) {
    return done(null, false);
  }
  const typedPayload = payload as { sub: number | string };
  const id = typeof typedPayload.sub === 'number' ? typedPayload.sub : Number.parseInt(typedPayload.sub, 10);
  return done(null, { id });
};

export default verify;
