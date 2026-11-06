import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

import { FieldValidationError } from '../errors.ts';
import log from '../helpers/logger.ts';

export type ValidationSchema = {
  params?: ZodType<object>;
  query?: ZodType<object>;
  body?: ZodType<object> | ZodType<object[]>;
  headers?: ZodType<object>;
};

function validateObject(object: unknown, label: string, schema: ZodType | undefined): void {
  if (schema) {
    const result = schema.safeParse(object);
    if (!result.success) {
      log.info(
        `Validation failed, invalid ${label}: ${result.error.issues
          .map((issue) => `[message: ${issue.message}, path: ${issue.path.join('.')}, type: ${issue.code}]`)
          .join(' - ')}`,
      );
      throw new FieldValidationError(`Invalid ${label}`, result.error.format());
    }
  }
}

// Checks the parts of the request against zod schemas: invalid requests are answered 400 with the details
export function validate(schema: ValidationSchema): RequestHandler {
  return (req, _res, next) => {
    validateObject(req.params, 'URL parameters', schema.params);
    validateObject(req.headers, 'Headers', schema.headers);
    validateObject(req.query, 'URL query', schema.query);
    // a request without a JSON body is validated as an empty object
    validateObject(req.body ?? {}, 'Body', schema.body);
    next();
  };
}
