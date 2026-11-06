import express from 'express';
import { register } from 'prom-client';

import config from '../config.ts';

const app = express();
app.disable('x-powered-by');
app.get(config.get('metrics.path'), async (_req, res) => {
  res.type(register.contentType).send(await register.metrics());
});

export const metricsApp = app;
