import baseConfig from './jest.config.psql.mjs';

export default {
  ...baseConfig,
  coverageDirectory: 'reports/coverage/psql',
  reporters: ['default', ['jest-junit', { outputName: 'reports/junit/js-test-results.xml' }]],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts'],
};
