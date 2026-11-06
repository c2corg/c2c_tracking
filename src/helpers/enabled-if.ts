import type { RequestHandler } from 'express';
import createHttpError from 'http-errors';

// The routes of a disabled tracker answer 405
const enabledIf =
  (condition: boolean): RequestHandler =>
  (_req, _res, next) => {
    next(condition ? undefined : createHttpError(405));
  };

export default enabledIf;
