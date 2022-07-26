import joi from 'joi';

import type { Schema } from '../validator';

const { number, object, string } = joi.types();

export const exchangeTokens: Schema = {
  query: object
    .keys({
      code: string.min(5).max(50),
      error: string,
      error_desscription: string,
    })
    .xor('code', 'error')
    .without('code', ['error_description'])
    .with('error', 'error_description'),
};

export const webhook: Schema = {
  body: object.keys({
    username: string.required().min(1).max(50),
    workoutid: number.required().min(1).max(Number.MAX_VALUE),
  }),
  headers: object.keys({
    Authorization: string.required(),
  }),
};
