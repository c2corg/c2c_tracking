import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // lcov for Codacy, json-summary and json for the coverage comment of the pull requests
      reporter: ['text-summary', 'lcov', 'json-summary', 'json'],
      reportsDirectory: 'reports/coverage',
      // a little below the current values (unit tests alone), so that a drop fails the build
      thresholds: { statements: 77, branches: 63, functions: 73, lines: 77 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['test/unit/**/*.spec.ts'],
          setupFiles: ['test/environment/env-vars.mjs'],
        },
      },
      {
        extends: true,
        test: {
          name: 'psql',
          include: ['test/psql/**/*.spec.ts'],
          setupFiles: ['test/environment/env-vars.mjs'],
          globalSetup: ['test/environment/psql-global-setup.ts'],
          // the tests share one database
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: 's3',
          include: ['test/s3/**/*.spec.ts'],
          setupFiles: ['test/environment/env-vars.s3.mjs'],
          // the tests share one bucket
          fileParallelism: false,
        },
      },
    ],
  },
});
