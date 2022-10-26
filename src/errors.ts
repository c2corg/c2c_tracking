import log from './helpers/logger';

export class AppError extends Error {
  public readonly code: number;
  public readonly description?: string;

  constructor(code: number, description?: string, cause?: Error, message?: string) {
    super(message, { ...(cause && { cause }) });
    if (description) {
      this.message = description;
    }
    log.info(description);
    this.code = code;
  }
}

export class ExternalApiError extends AppError {
  constructor(description: string, cause?: Error) {
    super(502, description, cause);
  }
}

export class NotFoundError extends AppError {
  constructor(description?: string, cause?: Error) {
    super(404, description, cause);
  }
}

export class IOError extends AppError {
  constructor(description: string, cause?: Error) {
    super(500, description, cause);
  }
}

export type FieldError = {
  message: string;
  type: string;
  path: string;
};

export class FieldValidationError extends AppError {
  constructor(description: string, details: unknown, cause?: Error) {
    super(400, description, cause, JSON.stringify(details, null, 2));
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super(403);
  }
}
