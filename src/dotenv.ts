import dotenv from 'dotenv';

if (process.env['NODE_ENV'] !== 'PRODUCTION') {
  dotenv.config();
}
