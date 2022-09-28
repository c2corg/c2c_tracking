import type { Request } from 'express';

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

export default c2cJwtExtractor;
