import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // `#src/*` (package.json "imports") points at ./dist for Node at runtime.
  // Tests must load ./src instead, otherwise they run against stale build
  // output and NestJS DI sees two copies of the same class.
  resolve: {
    alias: [{ find: /^#src\/(.*)$/, replacement: fileURLToPath(new URL('./src/$1', import.meta.url)) }],
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
