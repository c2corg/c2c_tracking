import convict from 'convict';
import isBase64 from 'validator/lib/isBase64';
import isStrongPassword from 'validator/lib/isStrongPassword';
import isUrl from 'validator/lib/isURL';
import isUUID from 'validator/lib/isUUID';

convict.addFormats({
  baseUrl: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    coerce: (v: any) => v.toString(),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    coerce: (v: any) => v.toString(),
    validate: (value: string) => {
      if (!isUUID(value, 4)) {
        throw new Error('must be a UUID version 4');
      }
    },
  },
  base64: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    coerce: (v: any) => v.toString(),
    validate: (value: string) => {
      if (!value.trim().length || !isBase64(value)) {
        throw new Error('must be a non-empty base64 string');
      }
    },
  },
  strongPassword: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    coerce: (v: any) => v.toString(),
    validate: (value: string) => {
      if (!isStrongPassword(value)) {
        throw new Error('must be a strong password');
      }
    },
  },
  notEmptyString: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    coerce: (v: any) => v.toString(),
    validate: (value: string) => {
      if (!value.trim().length) {
        throw new Error('must be a non-empty string');
      }
    },
  },
  storageBackend: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    coerce: (v: any) => v.toString(),
    validate: (value: string) => {
      if (!['s3', 'local'].includes(value.trim().toLocaleLowerCase())) {
        throw new Error('must be one of local and s3');
      }
    },
  },
});

const config = convict({
  env: {
    doc: 'The application environment',
    format: ['production', 'development', 'test', 'demo'],
    default: 'development',
    env: 'NODE_ENV',
  },
  version: {
    doc: 'The application version',
    format: 'notEmptyString',
    default: 'dev',
    env: 'npm_package_version',
  },
  server: {
    port: {
      doc: 'The port to bind',
      format: 'port',
      default: 8080,
      env: 'PORT',
      arg: 'port',
    },
    payload: {
      limit: {
        doc: 'The JSON payload size limit',
        format: 'notEmptyString',
        default: '50mb',
        env: 'SERVER_PAYLOAD_MAX_SIZE',
      },
    },
    baseUrl: {
      doc: 'Base URL the server binds to',
      format: 'baseUrl',
      default: '',
      env: 'SERVER_BASE_URL',
    },
  },
  metrics: {
    port: {
      doc: 'Port to bind metrics to',
      format: 'port',
      default: 8081,
      env: 'METRICS_PORT',
    },
    path: {
      doc: 'Path for serving metrics',
      format: 'notEmptyString',
      default: '/metrics',
      env: 'METRICS_PATH',
    },
  },
  db: {
    host: {
      doc: 'Database host name/IP',
      format: 'notEmptyString',
      default: 'localhost',
      env: 'DB_HOST',
    },
    name: {
      doc: 'Database name',
      format: 'notEmptyString',
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
      format: 'notEmptyString',
      default: 'postgres',
      env: 'DB_USER',
    },
    password: {
      doc: 'Database password',
      format: 'notEmptyString',
      default: 'postgres',
      env: 'DB_PASSWORD',
      sensitive: true,
    },
    schema: {
      doc: 'Database schema',
      format: 'notEmptyString',
      default: 'public',
      env: 'DB_SCHEMA',
    },
    ssl: {
      doc: 'Boolean to specify to enable SSL for connection',
      default: false,
      env: 'DB_ENABLE_SSL',
    },
    crypto: {
      doc: 'Secret key for encoding and decoding tokens',
      format: 'notEmptyString',
      default: '',
      env: 'DB_CRYPTO',
      sensitive: true,
    },
  },
  keyv: {
    connectionUri: {
      doc: 'Connection string in case keyv should be backed up by a specific storage. Currently supports only Redis',
      format: String,
      default: '',
      env: 'KEYV_CONNECTION_URI',
    },
  },
  auth: {
    jwtSecret: {
      doc: 'JWT auth secret key',
      format: 'notEmptyString',
      default: '',
      nullable: false,
      env: 'JWT_SECRET_KEY',
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
        default: 'trackers',
      },
    },
  },
  trackers: {
    strava: {
      enabled: {
        doc: 'Boolean to specify whether to enable connection with Strava',
        default: true,
        env: 'STRAVA_ENABLED',
      },
      clientId: {
        doc: 'Strava client ID',
        format: 'notEmptyString',
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
      enabled: {
        doc: 'Boolean to specify whether to enable connection with Suunto',
        default: true,
        env: 'SUUNTO_ENABLED',
      },
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
        default: 'trackers/suunto/exchange-token',
        env: 'SUUNTO_REDIRECT_URI',
      },
    },
    garmin: {
      enabled: {
        doc: 'Boolean to specify whether to enable connection with Garmin',
        default: true,
        env: 'GARMIN_ENABLED',
      },
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
    decathlon: {
      enabled: {
        doc: 'Boolean to specify whether to enable connection with Decathlon',
        default: true,
        env: 'DECATHLON_ENABLED',
      },
      clientId: {
        doc: 'Decathlon client ID',
        format: 'uuid4',
        default: 'b708af3b-fd46-41ab-af73-5176a0a56f92',
        env: 'DECATHLON_CLIENT_ID',
      },
      clientSecret: {
        doc: 'Decathlon client secret',
        format: 'base64',
        default: '',
        env: 'DECATHLON_CLIENT_SECRET',
        sensitive: true,
      },
      apiKey: {
        doc: 'Decahlon API key',
        format: 'uuid4',
        default: '',
        env: 'DECATHLON_API_KEY',
        sensitive: true,
      },
    },
    polar: {
      enabled: {
        doc: 'Boolean to specify whether to enable connection with Polar',
        default: true,
        env: 'POLAR_ENABLED',
      },
      clientId: {
        doc: 'Polar client ID',
        format: 'uuid4',
        default: '5a9f9ddd-fc15-48d2-bc56-86b43d491cc9',
        env: 'POLAR_CLIENT_ID',
      },
      clientSecret: {
        doc: 'Polar client secret',
        format: 'uuid4',
        default: '',
        env: 'POLAR_CLIENT_SECRET',
        sensitive: true,
      },
    },
    coros: {
      enabled: {
        doc: 'Boolean to specify whether to enable connection with Coros',
        default: true,
        env: 'COROS_ENABLED',
      },
      baseUrl: {
        doc: 'Specify base URL for Coros API',
        format: 'baseUrl',
        default: 'https://open.coros.com/',
        env: 'COROS_SERVER',
      },
      clientId: {
        doc: 'Coros client ID',
        format: 'notEmptyString',
        default: 'f263ed9257c74e808befaf548a27852c',
        env: 'COROS_CLIENT_ID',
      },
      clientSecret: {
        doc: 'Coros client secret',
        format: 'notEmptyString',
        default: '',
        env: 'COROS_CLIENT_SECRET',
        sensitive: true,
      },
    },
  },
  miniatures: {
    size: {
      doc: 'Miniature size in pixels',
      format: 'nat',
      default: 300,
      env: 'MINIATURES_SIZE',
    },
    mapbox: {
      token: {
        doc: 'Access token to MapBox API',
        format: 'notEmptyString',
        default: '',
        env: 'MAPBOX_TOKEN',
        sensitive: true,
      },
    },
    storage: {
      backend: {
        doc: 'Whether to use local or S3 storage',
        format: 'storageBackend',
        default: 's3',
        env: 'STORAGE_BACKEND',
      },
      s3: {
        endpoint: {
          format: 'baseUrl',
          default: 'http://localhost:9000/',
          env: 'S3_ENDPOINT',
        },
        region: {
          format: 'notEmptyString',
          default: 'ch-dk-2',
          env: 'S3_REGION',
        },
        bucket: {
          doc: 's3 bucket name (required for s3)',
          format: String,
          default: '',
          env: 'S3_BUCKET',
        },
        accessKeyId: {
          format: String,
          default: '',
          sensitive: true,
          env: 'S3_ACCESS_KEY_ID',
        },
        secretKey: {
          format: String,
          default: '',
          sensitive: true,
          env: 'S3_SECRET_KEY',
        },
      },
      local: {
        folder: {
          doc: 'local storage folder (required for local)',
          format: String,
          default: '',
          env: 'LOCAL_STORAGE_FOLDER',
        },
      },
    },
  },
});

config.validate({ allowed: 'strict' });

// additional validation
if (config.get('miniatures.storage.backend') === 's3' && !config.get('miniatures.storage.s3.bucket')) {
  throw new Error('Bucket must be defined for S3 storage.');
}
if (config.get('miniatures.storage.backend') === 'local' && !config.get('miniatures.storage.local.folder')) {
  throw new Error('Folder must be defined for loal storage');
}

export default config;
