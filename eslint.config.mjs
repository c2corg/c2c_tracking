import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import n from 'eslint-plugin-n';
import security from 'eslint-plugin-security';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/', 'reports/', 'coverage/']),
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  n.configs['flat/recommended'],
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  security.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
    },
    rules: {
      'n/no-extraneous-import': ['error', { allowModules: ['pino'] }],
      // resolution is checked by TypeScript and import-x
      'n/no-missing-import': 'off',
      'n/no-unpublished-import': ['error', { allowModules: ['type-fest'] }],
      'import-x/no-named-as-default-member': 'off',
      'import-x/order': [
        'error',
        {
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: false,
          },
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, destructuredArrayIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-member-accessibility': ['error', { overrides: { constructors: 'no-public' } }],
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'import-x/extensions': ['error', 'ignorePackages'],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  {
    files: ['test/**/*.ts', 'vitest.config.ts', 'eslint.config.mjs'],
    rules: {
      'n/no-unpublished-import': 'off',
      'n/no-extraneous-import': 'off',
    },
  },
  {
    files: ['test/**/*.ts'],
    extends: [vitest.configs.recommended],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      'vitest/unbound-method': 'error',
      // test fixtures and temporary files
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  prettier,
);
