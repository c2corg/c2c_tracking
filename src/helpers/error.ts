import axios from 'axios';

import { AppError } from '../errors';

import log from './logger';

export function handleAppError(code: number, message: string, error: unknown): AppError {
  if (error instanceof AppError) {
    // do not overwrite error if it's already specified as an app error
    throw error;
  }
  if (axios.isAxiosError(error)) {
    log.error(error);
    throw new AppError(code, message, error);
  }
  if (error instanceof Error) {
    throw new AppError(500, message, error);
  }
  if (typeof error === 'string') {
    throw new AppError(500, message, new Error(error));
  }
  throw new AppError(500, message);
}
