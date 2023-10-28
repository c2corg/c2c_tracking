import baseConfig from './jest.config.common.mjs';

export default {
  ...baseConfig,
  roots: ['<rootDir>/test/unit'],
  setupFiles: ['<rootDir>/test/environment/env-vars.mjs'],
};
