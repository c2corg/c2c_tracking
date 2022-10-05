import baseConfig from './jest.config.psql.mjs';

export default {
  ...baseConfig,
  globalSetup: '<rootDir>/test/environment/db-setup.ts',
};
