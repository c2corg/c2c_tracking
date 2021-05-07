export class AppError extends Error {
  public readonly code: number;
  public readonly cause?: Error;

  constructor(code: number, message: string, cause?: Error) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message);
  }
}

export class IOError extends AppError {
  constructor(message: string) {
    super(500, message);
  }
}

export interface FieldError {
  message: string;
  type: string;
  path: (string | number)[];
}

export class FieldValidationError extends AppError {
  constructor(message: string, readonly details: FieldError[]) {
    super(400, message);
  }
}
