import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';

const requestIds = new AsyncLocalStorage<string>();

// The id of the request being handled, undefined outside of a request
export const currentRequestId = (): string | undefined => requestIds.getStore();

// Gives each request an id, available to everything that runs for that request (the logs in particular)
export const requestId: RequestHandler = (_req, _res, next) => {
  requestIds.run(randomUUID(), next);
};
