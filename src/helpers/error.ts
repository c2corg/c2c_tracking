import { AppError, ExternalApiError } from '../errors.ts';
import { promApiErrorsCounter } from '../metrics/prometheus.ts';
import type { Vendor } from '../repository/activity.ts';

import { isHttpError } from './http.ts';
import log from './logger.ts';

export function handleExternalApiError(vendor: Vendor, message: string, error: unknown): AppError {
  if (error instanceof AppError) {
    // do not overwrite error if it's already specified as an app error
    throw error;
  }
  if (isHttpError(error)) {
    promApiErrorsCounter.labels({ vendor, name: error.url, ...(error.code && { code: error.code }) }).inc(1);
    log.warn(error);
    throw new ExternalApiError(message, error);
  }
  if (error instanceof Error) {
    log.warn(error);
    throw new AppError(500, message, error);
  }
  if (typeof error === 'string') {
    log.warn(error);
    throw new AppError(500, message, new Error(error));
  }
  throw new AppError(500, message);
}
