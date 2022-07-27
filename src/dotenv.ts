import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

if (process.env['NODE_ENV'] !== 'PRODUCTION') {
  dotenvExpand.expand(dotenv.config());
}
