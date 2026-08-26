import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  { ignores: ['dist/**', 'coverage/**'] },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        AbortSignal: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
      },
    },
  },
];
