import baseConfig from './jest.config.common.mjs';

export default {
  ...baseConfig,
  displayName: 'PSQL',
  roots: ['<rootDir>/test/psql'],
  setupFiles: ['<rootDir>/test/environment/env-vars.mjs'],
};
