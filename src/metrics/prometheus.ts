import { collectDefaultMetrics, Counter, Gauge, register, Summary } from 'prom-client';

import config from '../config';

register.setDefaultLabels({ service: 'c2c_tracking' });

// default metrics
if (!process.env['JEST_WORKER_ID']) {
  collectDefaultMetrics();
}

// API call errors counter
export const promApiErrorsCounter = new Counter({
  name: 'api_errors_counter',
  help: 'API Errors Counter',
  labelNames: ['vendor', 'name', 'code'],
});

// unhandled errors
export const promUnhandledErrorsCounter = new Counter({
  name: 'unhandled_errors_counter',
  help: 'Unhandled Errors Counter',
});

// API response time
export const promResponseTimeSummary = new Summary({
  name: 'response_time',
  help: 'Response time',
  labelNames: ['method', 'name'],
});

export const promWebhookCounter = new Counter({
  name: 'webhooks',
  help: 'Webhooks Counter',
  labelNames: ['vendor', 'subject', 'event'],
});

export const promWebhookErrorsCounter = new Counter({
  name: 'webhooks_errors',
  help: 'Webhook errors',
  labelNames: ['vendor', 'cause'],
});

export const promTokenRenewalErrorsCounter = new Counter({
  name: 'token_renewal_errors',
  help: 'Token Renewal Errors',
  labelNames: ['vendor'],
});

// service info
const info = new Gauge({
  name: `service_info`,
  help: 'Service info',
  labelNames: ['version', 'env'],
});

info.labels(config.get('version'), config.get('env')).set(1);
