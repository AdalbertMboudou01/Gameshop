import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'data/', 'test-results/'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-shadow': 'error',
      'no-param-reassign': ['error', { props: false }],
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'no-console': 'off',
    },
  },
  {
    files: ['server/**/*.js', 'scripts/**/*.js', 'tests/**/*.{js,mjs}', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Les callbacks page.evaluate() du test E2E s'exécutent dans le navigateur.
    files: ['tests/e2e.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { globals: globals.browser },
    rules: {
      // Le front ne parle au serveur que via core/api.js.
      'no-restricted-globals': ['error', { name: 'fetch', message: 'Passer par core/api.js.' }],
    },
  },
  {
    files: ['public/js/core/api.js'],
    rules: { 'no-restricted-globals': 'off' },
  },
];
