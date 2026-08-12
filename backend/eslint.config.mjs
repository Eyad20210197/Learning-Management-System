// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      'dist/**',
      'coverage/**',
      'libs/platform/src/database/generated/prisma/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@lms/*/*'],
              message:
                'Import another bounded context through its public entrypoint.',
            },
          ],
        },
      ],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    files: ['libs/*/src/domain/**/*.ts', 'libs/shared-kernel/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@lms/*/*'],
              message:
                'Import another bounded context through its public entrypoint.',
            },
            {
              group: [
                '@nestjs/*',
                '@prisma/*',
                '@lms/platform',
                'bullmq',
                'express',
                'ioredis',
              ],
              message:
                'Domain and shared-kernel code must remain framework-independent.',
            },
          ],
        },
      ],
    },
  },
);
