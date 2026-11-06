/** Parses the comma-separated list of extra origins, ignoring blanks and trailing slashes. */
export const parseExtraOrigins = (extraOrigins: string): string[] =>
  extraOrigins
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);

/**
 * Builds the `origin` option of the cors middleware: the request origin if it is the main frontend or one of the
 * extra origins, the main frontend otherwise (the browser then refuses the response).
 */
export const corsOrigin = (
  baseUrl: string,
  extraOrigins: string,
): ((origin: string | undefined, callback: (error: Error | null, origin: string) => void) => void) => {
  const main = baseUrl.replace(/\/+$/, '');
  const allowed = new Set([main, ...parseExtraOrigins(extraOrigins)]);
  return (origin, callback) => {
    callback(null, origin && allowed.has(origin) ? origin : main);
  };
};
