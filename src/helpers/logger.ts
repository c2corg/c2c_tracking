import { type DestinationStream, type Logger, pino } from 'pino';

import { isHttpError } from './http.ts';
import { currentRequestId } from './request-id.ts';

/*
 * The request of a failed API call holds secrets: client secrets and tokens in its parameters, body, headers and
 * basic auth. Its error (HttpError) keeps only what tells which call failed and why, and so does the log.
 */
export const serializeError = (error: unknown): unknown => {
  if (isHttpError(error)) {
    // the request headers, body and query string are not in the error
    return {
      type: 'HttpError',
      message: error.message,
      code: error.code,
      method: error.method,
      url: error.url,
      status: error.status,
      response: error.data,
    };
  }
  return error instanceof Error ? pino.stdSerializers.err(error) : error;
};

export const createLogger = (destination?: DestinationStream): Logger => {
  const options = {
    mixin(): object {
      return { requestId: currentRequestId() };
    },
    serializers: { err: serializeError },
  };
  return destination ? pino(options, destination) : pino(options);
};

const log = createLogger();

export default log;
