import baseConfig from './jest.config.common.mjs';

export default {
  ...baseConfig,
  displayName: 'S3',
  roots: ['<rootDir>/test/s3'],
  setupFiles: ['<rootDir>/test/environment/env-vars.s3.mjs'],
};
