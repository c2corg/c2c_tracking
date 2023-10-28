import type { Request } from 'express';

const c2cJwtExtractor = (request: Request): string | null => {
  const authHeader = request.headers['authorization'];
  if (typeof authHeader !== 'string') {
    return null;
  }
  return (
    [/JWT token="([\w-.]+)"/, /Bearer ([\w-.]+)/]
      .map((regex) => regex.exec(authHeader))
      .find((found) => !!found && found.length === 2)?.[1] ?? null
  );
};

export default c2cJwtExtractor;
