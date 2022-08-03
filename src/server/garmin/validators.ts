import joi from 'joi';

import type { Schema } from '../validator';

const { array, number, object, string } = joi.types();

export const requestToken: Schema = {};

export const exchangeToken: Schema = {
  query: object
    .keys({
      oauth_token: string.min(10).max(50),
      oauth_verifier: string.min(4).max(50),
    })
    .required(),
};

export const deauthorize: Schema = {};

export const activityWebhook: Schema = {
  body: object
    .keys({
      activityDetails: array.items(
        object.keys({
          userId: string.required(),
          userAccessToken: string.required(),
          activityId: number.required(),
          summary: object
            .keys({
              activityType: string.required(),
              startTimeInSeconds: number.positive().required(),
            })
            .required(),
          samples: array.items(
            object.keys({
              startTimeInSeconds: number.min(0),
              latitudeInDegree: number,
              longitudeInDegree: number,
              elevationInMeters: number.min(0),
            }),
          ),
        }),
      ),
    })
    .required(),
};

export const deauthorizeWebhook: Schema = {
  body: object.keys({
    deregistrations: array
      .items(
        object.keys({
          userId: string.required(),
          userAccessToken: string.required(),
        }),
      )
      .required(),
  }),
};
