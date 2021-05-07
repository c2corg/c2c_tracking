import { number, object, string } from 'joi';

import { Schema } from '../validator';

export const exchangeTokens: Schema = {
  query: object({
    code: string().required().min(10).max(50),
    scope: string()
      .required()
      .pattern(/(?:[\w:]{1,30},){0,4}(?:[\w:]{1,30})/),
    state: number().required().positive().min(1).max(99999999),
  }),
};
