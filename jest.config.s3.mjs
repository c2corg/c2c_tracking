export default {
  roots: ['<rootDir>/test/s3'],
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest'],
  },
  setupFiles: ['<rootDir>/test/environment/env-vars.s3.mjs'],
};
