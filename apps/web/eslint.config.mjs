import config from '@exness/eslint-config/service.mjs';

export default [
  ...config,
  {
    ignores: ['.next/**', 'node_modules/**', 'public/**', 'next-env.d.ts'],
  },
];
