import log from './helpers/logger.js';

export class AppError extends Error {
  constructor(public readonly code: number, message?: string, cause?: Error, public readonly body?: string) {
    super(message, { ...(cause && { cause }) });
    log.warn(message);
    this.code = code;
  }
}

export class ExternalApiError extends AppError {
  constructor(message?: string, cause?: Error, body?: string) {
    super(502, message, cause, body);
  }
}

export class NotFoundError extends AppError {
  constructor(message?: string, cause?: Error, body?: string) {
    super(404, message, cause, body);
  }
}

export class IOError extends AppError {
  constructor(message: string, cause?: Error, body?: string) {
    super(500, message, cause, body);
  }
}

export type FieldError = {
  message: string;
  type: string;
  path: string;
};

export class FieldValidationError extends AppError {
  constructor(message: string, details: unknown, cause?: Error) {
    super(400, message, cause, JSON.stringify(details, null, 2));
  }
}
