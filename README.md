# c2c_tracking

[![GitHub license](https://img.shields.io/github/license/c2corg/c2c_tracking.svg)](https://github.com/c2corg/c2c_tracking/blob/main/LICENSE) ![Continuous integration](https://github.com/c2corg/c2c_tracking/workflows/Continuous%20Integration/badge.svg?branch=main) ![Github Code scanning](https://github.com/c2corg/c2c_tracking/workflows/CodeQL/badge.svg?branch=main) [![Codacy Badge](https://app.codacy.com/project/badge/Grade/7d16c363ea1d445293e216e58e884194)](https://www.codacy.com/gh/c2corg/c2c_tracking/dashboard?utm_source=github.com&utm_medium=referral&utm_content=c2corg/c2c_tracking&utm_campaign=Badge_Grade) [![Codacy Badge](https://app.codacy.com/project/badge/Coverage/7d16c363ea1d445293e216e58e884194)](https://www.codacy.com/gh/c2corg/c2c_tracking/dashboard?utm_source=github.com&utm_medium=referral&utm_content=c2corg/c2c_tracking&utm_campaign=Badge_Coverage)

Tiny server to handle connection with activity trackers such as Strava, Garmin or Suunto

## Architecture diagrams

Click a diagram to open its interactive version (zoom, search, details, links to the source code). All the diagrams of camptocamp.org: <https://c2corg.github.io/v6_api/>.

### Tracker (c2c_tracking)

[![Tracker (c2c_tracking)](docs/architecture/tracker.png)](https://c2corg.github.io/v6_api/architecture/tracker.html)


## Install

Requires Node.js 26 (see `engines`).

```sh
npm install
```

## Development

- Configure Strava, Suunto, etc. applications. You might use `ngrok` tool to make your localhost application reachable from the internet.
- Set required environment variables in `.env` file.
- Launch the app: `npm run start`

### Database connection

`DB_ENABLE_SSL=true` encrypts the connection to PostgreSQL. By default the server certificate is **not** checked.
To check it (chain and host name, `DB_HOST` must be a name of the certificate):

- `DB_SSL_REJECT_UNAUTHORIZED=true`;
- `DB_SSL_CA_FILE=/path/to/ca.crt` when the server certificate comes from a private authority (without it, the system
  authorities are used).

You can debug server and tests within Visual Studio Code using the predefined configurations in `launch.json`.

### Health

- `GET /health`: liveness, the process answers (version, uptime, enabled trackers). Used by the Docker health check.
- `GET /health/ready`: readiness, 200 when the database answers within 2 s, 503 otherwise.

### Routes

Every route validates its input (URL parameters, query, headers, body) with `validate(...)` and zod schemas
(`src/server/*/*.validators.ts`); routes that read nothing use `validate(noInput)`. The local ESLint rule
`local/require-route-validation` (`eslint-rules/`) enforces it.

### Tests

Tests run with [Vitest](https://vitest.dev), in three projects:

- `npm run test:unit`: unit tests, no external service needed (`npm run test:watch` to rerun them on change);
- `npm run test:psql`: repository tests, against the PostgreSQL of `docker compose -f docker-compose.psql.yml up -d`.
  The schema of the `postgres` database is recreated before the run;
- `npm run test:s3`: storage tests, against the in-memory S3 server (Scality CloudServer) of
  `docker compose -f docker-compose.s3.yml up -d s3`. The tests create the bucket.

`npm test` runs the unit and psql tests.

## Release

To create a release,

- On `main` branch, run command `npm version (major|minor|patch)` to update `package(-lock).json` versions and create a tag.
- Push tag
- CI/CD process will automatically create the release from tag and generate release notes.

In order to produce nice release notes:

- Assign labels to pull requests
- See [release.yml](https://github.com/c2corg/c2c_tracking/blob/main/.github/release.yml) to define categories.
