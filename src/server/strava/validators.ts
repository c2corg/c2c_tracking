import joi from 'joi';

import type { Schema } from '../validator';

const { number, object, string } = joi.types();

export const exchangeToken: Schema = {
  query: object
    .keys({
      code: string.min(10).max(50),
      scope: string.pattern(/(?:[\w:]{1,30},){0,4}(?:[\w:]{1,30})/),
      state: string.allow(''),
      error: string,
    })
    .xor('code', 'error')
    .with('code', ['scope']),
};

export const webhookSubscription: Schema = {
  query: object.keys({
    'hub.mode': string.required().equal('subscribe'),
    'hub.challenge': string.required(),
    'hub.verify_token': string.required(),
  }),
};

export const webhook: Schema = {
  body: object.keys({
    object_type: string.required().equal('activity', 'athlete'),
    object_id: number.required(),
    aspect_type: string.equal('create', 'update', 'delete'),
    updates: object.pattern(string, string),
    owner_id: number.required(),
    subscription_id: number.required(),
    event_time: number.required(),
  }),
};

export const deauthorize: Schema = {};
