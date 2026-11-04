import type { Context } from 'koa';

/** Parses the comma-separated list of extra origins, ignoring blanks and trailing slashes. */
export const parseExtraOrigins = (extraOrigins: string): string[] =>
  extraOrigins
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);

/**
 * Builds the `origin` option of @koa/cors: the request origin if it is the main frontend or one of the extra
 * origins, the main frontend otherwise (the browser then refuses the response).
 */
export const corsOrigin = (baseUrl: string, extraOrigins: string): ((ctx: Context) => string) => {
  const main = baseUrl.replace(/\/+$/, '');
  const allowed = new Set([main, ...parseExtraOrigins(extraOrigins)]);
  return (ctx: Context): string => {
    const origin = ctx.get('Origin');
    return allowed.has(origin) ? origin : main;
  };
};
