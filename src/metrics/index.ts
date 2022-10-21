import http from 'http';

import { register } from 'prom-client';

import config from '../config';

const server = http.createServer();
server.on('request', async (request, response) => {
  if (request.url !== config.get('metrics.path')) {
    response.writeHead(404);
    response.end();
  }
  response.end(await register.metrics());
});

export const metricsServer = server;
