import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary', 'lcov'],
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
