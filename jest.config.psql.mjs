import baseConfig from './jest.config.common.mjs';

export default {
  ...baseConfig,
  roots: ['<rootDir>/test/psql'],
  setupFiles: ['<rootDir>/test/environment/env-vars.mjs'],
};
