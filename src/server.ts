import Koa from 'koa';
import helmet from 'koa-helmet';
import logger from 'koa-pino-logger';
import Router from 'koa-router';
import { defaultErrorHandler } from './error-handler';
import { logRequest } from './log-request';

import strava from './strava';

const PORT = 8082;
const app = new Koa();
const router = new Router();

router.use('/strava', strava.routes(), strava.allowedMethods());

app
  .use(helmet())
  .use(logger())
  .use(logRequest())
  .use(defaultErrorHandler())
  .use(router.routes())
  .use(router.allowedMethods());
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
