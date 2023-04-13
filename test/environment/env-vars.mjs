// eslint-disable-next-line @typescript-eslint/no-var-requires
const os = require('node:os');

process.env['SERVER_BASE_URL'] = 'http://localhost:3000/';
process.env['DB_CRYPTO'] = 'secret';
process.env['JWT_SECRET_KEY'] = 'secret';
process.env['STRAVA_CLIENT_SECRET'] = 'd37d09886c3a92ced03feca580ccecd5630559ec';
process.env['STRAVA_WEBHOOK_SUBSCRIPTION_VERIFY_TOKEN'] = '%trongpAssM0rd';
process.env['SUUNTO_CLIENT_SECRET'] = 'secret';
process.env['SUUNTO_SUBSCRIPTION_KEY'] = '4b24a2b497479fb5319543fdff28a495';
process.env['SUUNTO_WEBHOOK_SUBSCRIPTION_TOKEN'] = '2fbbd34d-4dc3-44fc-8a47-9ba1bc037d2c';
process.env['GARMIN_CONSUMER_SECRET'] = 'secret';
process.env['DECATHLON_CLIENT_SECRET'] = 'c2VjcmV0';
process.env['DECATHLON_API_KEY'] = '9ccc19db-faaa-49ab-b1e1-8ab30cc7761d';
process.env['POLAR_CLIENT_SECRET'] = '902d20cc-c2a8-4536-89a9-41e0f7626977';
process.env['COROS_CLIENT_SECRET'] = '902d20cc-c2a8-4536-89a9-41e0f7626977';
process.env['MAPBOX_TOKEN'] = 'mapbox-token';
process.env['STORAGE_BACKEND'] = 'local';
process.env['LOCAL_STORAGE_FOLDER'] = `${os.tmpdir()}/tracking`;
