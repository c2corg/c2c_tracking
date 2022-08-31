import rTracer from 'cls-rtracer';
import pino from 'pino';

const log = pino({
  mixin() {
    return { requestId: rTracer.id() };
  },
});

export default log;
