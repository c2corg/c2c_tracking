import axios from 'axios';

import { AppError, ExternalApiError } from '../errors';
import { promApiErrorsCounter } from '../metrics/prometheus';
import type { Vendor } from '../repository/activity';

import log from './logger';

export function handleExternalApiError(vendor: Vendor, message: string, error: unknown): AppError {
  if (error instanceof AppError) {
    // do not overwrite error if it's already specified as an app error
    throw error;
  }
  if (axios.isAxiosError(error)) {
    promApiErrorsCounter
      .labels({ vendor, ...(error.config && { name: error.config?.url }), ...(error.code && { code: error.code }) })
      .inc(1);
    log.warn(error);
    log.warn(error.response?.data);
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
