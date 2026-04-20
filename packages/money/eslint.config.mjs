import config from '@exness/eslint-config/library.mjs';

// api.ts is the single boundary where bigint → number conversion is allowed.
export default [
  ...config,
  {
    files: ['src/api.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];
