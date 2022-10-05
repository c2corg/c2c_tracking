export default {
  roots: ['<rootDir>/test/psql'],
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest'],
  },
  setupFiles: ['<rootDir>/test/environment/env-vars.mjs'],
};
