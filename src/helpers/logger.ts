import axios from 'axios';
import rTracer from 'cls-rtracer';
import pino, { type DestinationStream, type Logger } from 'pino';

/*
 * The request of a failed API call holds secrets: client secrets and tokens in its parameters, body, headers and
 * basic auth. Keep only what tells which call failed and why.
 */
export const serializeError = (error: unknown): unknown => {
  if (axios.isAxiosError(error)) {
    return {
      type: 'AxiosError',
      message: error.message,
      code: error.code,
      method: error.config?.method,
      // without the query string, which may hold secrets too
      url: error.config?.url?.split('?')[0],
      status: error.response?.status,
      response: error.response?.data as unknown,
    };
  }
  return error instanceof Error ? pino.stdSerializers.err(error) : error;
};

export const createLogger = (destination?: DestinationStream): Logger => {
  const options = {
    mixin(): object {
      return { requestId: rTracer.id() };
    },
    serializers: { err: serializeError },
  };
  return destination ? pino(options, destination) : pino(options);
};

const log = createLogger();

export default log;
