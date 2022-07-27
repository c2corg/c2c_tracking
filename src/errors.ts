export class AppError extends Error {
  readonly code: number;

  constructor(code: number, message: string, cause?: Error) {
    super(message, { ...(cause && { cause }) });
    this.code = code;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, cause?: Error) {
    super(404, message, cause);
  }
}

export class IOError extends AppError {
  constructor(message: string, cause?: Error) {
    super(500, message, cause);
  }
}

export type FieldError = {
  message: string;
  type: string;
  path: (string | number)[];
};

export class FieldValidationError extends AppError {
  constructor(message: string, readonly details: FieldError[], cause?: Error) {
    super(400, message, cause);
  }
}
