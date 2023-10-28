import Router from '@koa/router';
import Koa from 'koa';
import { register } from 'prom-client';

import config from '../config.js';

const koa = new Koa();
const router = new Router();
router.get(config.get('metrics.path'), async (ctx) => {
  ctx.body = await register.metrics();
});
koa.use(router.routes());

export const metricsKoa = koa;
