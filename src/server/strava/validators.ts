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

export const webhookSubscription: Schema = {
  query: object({
    'hub.mode': string().required().equal('subscribe'),
    'hub.challenge': string().required(),
    'hub.verify_token': string().required(),
  }),
};

export const webhook: Schema = {
  body: object({
    object_type: string().required().equal('activity', 'athlete'),
    object_id: number().required(),
    aspect_type: string().equal('create', 'update', 'delete'),
    updates: object().pattern(string(), string()),
    owner_id: number().required(),
    subscription_id: number().required(),
    event_time: number().required(),
  }),
};
