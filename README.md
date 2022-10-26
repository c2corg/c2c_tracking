# c2c_tracking

[![GitHub license](https://img.shields.io/github/license/c2corg/c2c_tracking.svg)](https://github.com/c2corg/c2c_tracking/blob/main/LICENSE) ![Continuous integration](https://github.com/c2corg/c2c_tracking/workflows/Continuous%20Integration/badge.svg?branch=main) ![Github Code scanning](https://github.com/c2corg/c2c_tracking/workflows/CodeQL/badge.svg?branch=main) [![Codacy Badge](https://app.codacy.com/project/badge/Grade/7d16c363ea1d445293e216e58e884194)](https://www.codacy.com/gh/c2corg/c2c_tracking/dashboard?utm_source=github.com&utm_medium=referral&utm_content=c2corg/c2c_tracking&utm_campaign=Badge_Grade) [![Codacy Badge](https://app.codacy.com/project/badge/Coverage/7d16c363ea1d445293e216e58e884194)](https://www.codacy.com/gh/c2corg/c2c_tracking/dashboard?utm_source=github.com&utm_medium=referral&utm_content=c2corg/c2c_tracking&utm_campaign=Badge_Coverage)

Tiny server to handle connection with activity trackers such as Strava, Garmin or Suunto

## Install

```sh
npm install
```

## Development

- Configure Strava, Suunto, etc. applications. You might use `ngrok` tool to make your localhost application reachable from the internet.
- Set required environment variables in `.env` file.
- Launch the app: `npm run start`

You can debug server and tests within Visual Studio Code using the predefined configurations in `launch.json`.

## Release

To create a release,

- On `main` branch, run command `npm version (major|minor|patch)` to update `package(-lock).json` versions and create a tag.
- Push tag
- CI/CD process will automatically create the release from tag and generate release notes.

In order to produce nice release notes:

- Assign labels to pull requests
- See [release.yml](https://github.com/c2corg/c2c_tracking/blob/main/.github/release.yml) to define categories.
