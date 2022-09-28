module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser', // Specifies the ESLint parser
  extends: [
    'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    'prettier', // Uses eslint-config-prettier to disable ESLint rules from @typescript-eslint/eslint-plugin that would conflict with prettier
    'plugin:node/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:security/recommended',
    'plugin:prettier/recommended', // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module', // Allows for the use of imports,
  },
  rules: {
    'node/no-extraneous-import': ['error', { allowModules: ['pino'] }],
    'node/no-missing-import': 'off',
    'node/no-unsupported-features/es-syntax': 'off',
    'import/order': [
      'error',
      {
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: false,
        },
      },
    ],
    '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, destructuredArrayIgnorePattern: '^_' }],
    '@typescript-eslint/camelcase': 'off',
    '@typescript-eslint/explicit-function-return-type': 'error',
  },
  overrides: [
    {
      files: ['./**/*.ts]'],
      rules: {
        '@typescript-eslint/no-throw-literal': 'error',
      },
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
      },
    },
    {
      files: ['test/**/*.ts'],
      rules: {
        'node/no-unpublished-import': 'off',
        'node/no-extraneous-import': 'off',
      },
    },
  ],
  settings: {
    'import/resolvers': {
      typescript: {
        alwaysTryTypes: true, // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`
        project: '.',
      },
    },
  },
};
