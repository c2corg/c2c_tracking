import type { ArraySchema, ObjectSchema, ValidationOptions } from 'joi';
import type { Context } from 'koa';
import type { IMiddleware } from 'koa-router';

import { FieldValidationError } from '../errors';

export interface Schema {
  query?: ObjectSchema;
  body?: ObjectSchema | ArraySchema;
  headers?: ObjectSchema;
}

function validateObject(
  object: unknown = {},
  label: string,
  schema: ObjectSchema | ArraySchema | undefined,
  options: ValidationOptions,
): void {
  if (schema) {
    const { error } = schema.validate(object, options);
    if (error) {
      // Throw error with custom message if validation failed
      throw new FieldValidationError(
        `Invalid ${label}`,
        error.details.map((f) => ({ message: f.message, path: f.path, type: f.type })),
      );
    }
  }
}

export function validate(schema: Schema): IMiddleware {
  return async (ctx: Context, next: () => Promise<unknown>): Promise<void> => {
    ctx.headers && validateObject(ctx.headers, 'Headers', schema.headers, { allowUnknown: true, abortEarly: true });
    ctx.query && validateObject(ctx.query, 'URL query', schema.query, { allowUnknown: true, abortEarly: true });
    ctx.request.body && validateObject(ctx.request.body, 'Body', schema.body, { allowUnknown: true, abortEarly: true });
    await next();
  };
}
