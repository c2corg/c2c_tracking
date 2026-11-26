import log from './helpers/logger.ts';

export class AppError extends Error {
  public readonly code: number;
  public readonly body: string | undefined;

  constructor(code: number, message?: string, cause?: Error, body?: string) {
    super(message, { ...(cause && { cause }) });
    log.warn(message);
    this.code = code;
    this.body = body;
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

// The vendor account is already linked to another c2c user: a vendor account can only be linked to one user
export class AlreadyLinkedError extends AppError {
  constructor(message?: string, cause?: Error) {
    super(409, message, cause, 'already-linked');
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
