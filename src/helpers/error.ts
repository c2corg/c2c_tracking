import axios from 'axios';

import { AppError } from '../errors';

export function handleAppError(code: number, message: string, error: unknown): AppError {
  if (axios.isAxiosError(error)) {
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
