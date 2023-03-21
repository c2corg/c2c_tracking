import type { Middleware } from '@koa/router';
import type { Context } from 'koa';
import type { Schema } from 'zod';

import { FieldValidationError } from '../errors';
import log from '../helpers/logger';

export type ValidationSchema = {
  query?: Schema<object>;
  body?: Schema<object> | Schema<Array<object>>;
  headers?: Schema<object>;
};

function validateObject(object: unknown = {}, label: string, schema: Schema | undefined): void {
  if (schema) {
    const result = schema.safeParse(object);
    if (!result.success) {
      // Throw error with custom message if validation failed
      log.info(
        `Validation failed, invalid ${label}: ${result.error.issues
          .map((issue) => `[message: ${issue.message}, path: ${issue.path.join('.')}, type: ${issue.code}]`)
          .join(' - ')}`,
      );
      throw new FieldValidationError(`Invalid ${label}`, result.error.format());
    }
  }
}

export function validate(schema: ValidationSchema): Middleware {
  return async (ctx: Context, next: () => Promise<unknown>): Promise<void> => {
    ctx.headers && validateObject(ctx.headers, 'Headers', schema.headers);
    ctx.query && validateObject(ctx.query, 'URL query', schema.query);
    ctx.request.body && validateObject(ctx.request.body, 'Body', schema.body);
    await next();
  };
}
