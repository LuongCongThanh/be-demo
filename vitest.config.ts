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
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/generated/**', 'src/main.ts'],
      // Ngưỡng coverage tạm tắt trong lúc rebuild (Phase 1–6 không viết test).
      // Bật lại ở Phase 7: thresholds: { lines: 50, functions: 50, branches: 50, statements: 50 }.
    },
  },
});
