import convict from 'convict';
import isBase64 from 'validator/lib/isBase64';
import isStrongPassword from 'validator/lib/isStrongPassword';
import isUrl from 'validator/lib/isURL';
import isUUID from 'validator/lib/isUUID';

convict.addFormats({
  baseUrl: {
    coerce: (v) => v.toString(),
    validate: (value: string) => {
      if (!isUrl(value, { require_tld: false, require_protocol: false })) {
        throw new Error('must be a URL');
      }
      if (!value.endsWith('/')) {
        throw new Error('must end with a /');
      }
    },
  },
  uuid4: {
    coerce: (v) => v.toString(),
    validate: (value: string) => {
      if (!isUUID(value, 4)) {
        throw new Error('must be a UUID vrsion 4');
      }
    },
  },
  base64: {
    coerce: (v) => v.toString(),
    validate: (value: string) => {
      if (!isBase64(value)) {
        throw new Error('must be a base64 string');
      }
    },
  },
  strongPassword: {
    coerce: (v) => v.toString(),
    validate: (value: string) => {
      if (!isStrongPassword(value)) {
        throw new Error('must be a strong password');
      }
    },
  },
  notEmptyString: {
    coerce: (v) => v.toString(),
    validate: (value: string) => {
      if (!value.trim().length) {
        throw new Error('must be a non-empty string');
      }
    },
  },
});

const config = convict({
  env: {
    doc: 'The application environment',
    format: ['production', 'development', 'test'],
    default: 'development',
    env: 'NODE_ENV',
  },
  server: {
    port: {
      doc: 'The port to bind',
      format: 'port',
      default: 8082,
      env: 'PORT',
      arg: 'port',
    },
    baseUrl: {
      doc: 'Base URL the server binds to',
      format: 'baseUrl',
      default: '',
      env: 'SERVER_BASE_URL',
    },
  },
  db: {
    host: {
      doc: 'Database host name/IP',
      format: String,
      default: 'localhost',
      env: 'DB_HOST',
    },
    name: {
      doc: 'Database name',
      format: String,
      default: 'postgres',
      env: 'DB_NAME',
    },
    port: {
      doc: 'Database port',
      format: 'port',
      default: 5432,
      env: 'DB_PORT',
    },
    user: {
      doc: 'Database user',
      format: String,
      default: 'postgres',
      env: 'DB_USER',
    },
    password: {
      doc: 'Database password',
      format: String,
      default: 'postgres',
      env: 'DB_PASSWORD',
      sensitive: true,
    },
  },
  c2c: {
    frontend: {
      baseUrl: {
        doc: 'Base URL for frontend',
        format: 'baseUrl',
        default: 'http://localhost:8080/',
        env: 'FRONTEND_BASE_URL',
      },
      subscriptionPath: {
        doc: 'Path (appended to base URL) for subscription URL',
        format: String,
        default: 'external-services',
      },
    },
  },
  trackers: {
    strava: {
      clientId: {
        doc: 'Strava client ID',
        format: String,
        default: '63968',
        env: 'STRAVA_CLIENT_ID',
      },
      clientSecret: {
        doc: 'Strava client secret',
        format: 'base64',
        default: '',
        env: 'STRAVA_CLIENT_SECRET',
        sensitive: true,
      },
      webhookSubscriptionVerifyToken: {
        doc: 'Strava webhook subscription verify token',
        format: 'strongPassword',
        default: '',
        env: 'STRAVA_WEBHOOK_SUBSCRIPTION_VERIFY_TOKEN',
        sensitive: true,
      },
    },
    suunto: {
      clientId: {
        doc: 'Suunto client ID',
        format: 'uuid4',
        default: '2928e564-85eb-4aef-92fb-2a0259589c9c',
        env: 'SUUNTO_CLIENT_ID',
      },
      clientSecret: {
        doc: 'Suunto client secret',
        format: 'notEmptyString',
        default: '',
        env: 'SUUNTO_CLIENT_SECRET',
        sensitive: true,
      },
      subscriptionKey: {
        doc: 'Suunto subscription key',
        format: 'base64',
        default: '',
        env: 'SUUNTO_SUBSCRIPTION_KEY',
        sensitive: true,
      },
      webhookSubscriptionToken: {
        doc: 'Suunto webhook subscription token',
        format: 'uuid4',
        default: '',
        env: 'SUUNTO_WEBHOOK_SUBSCRIPTION_TOKEN',
        sensitive: true,
      },
      redirectPath: {
        doc: 'Path (appended to c2c.frontend.baseUrl) to define URL to redirect to',
        format: String,
        default: 'external-services/suunto/exchange-token',
        env: 'SUUNTO_REDIRECT_URI',
      },
    },
    garmin: {
      consumerKey: {
        doc: 'Garmin consumer key',
        format: 'uuid4',
        default: 'f6af0bcb-ed47-4383-90e8-46351c764d4b',
        env: 'GARMIN_CONSUMER_KEY',
      },
      consumerSecret: {
        doc: 'Garmin consumer secret',
        format: 'notEmptyString',
        default: '',
        env: 'GARMIN_CONSUMER_SECRET',
        sensitive: true,
      },
    },
  },
});

config.validate({ allowed: 'strict' });

export default config;
