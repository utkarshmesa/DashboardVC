import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/**', 'node_modules/**', 'spike/**', 'next-env.d.ts'] },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/spike/**', 'spike/*'], message: 'Phase 0 spike code must not be imported (SPEC §6).' }],
      }],
    },
  },
  {
    // SPEC §10: client code must never import the service-role DB module.
    files: ['components/**/*.{ts,tsx}', '**/*.client.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: '@/lib/db', message: 'lib/db is server-only (service-role key).' }],
        patterns: [
          { group: ['**/lib/db', '**/lib/store'], message: 'lib/db is server-only (service-role key).' },
          { group: ['**/spike/**'], message: 'Phase 0 spike code must not be imported (SPEC §6).' },
        ],
      }],
    },
  },
];

export default config;
