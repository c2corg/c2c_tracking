export default {
  roots: ['<rootDir>/test/unit'],
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest'],
  },
  setupFiles: ['<rootDir>/test/environment/env-vars.mjs'],
};
