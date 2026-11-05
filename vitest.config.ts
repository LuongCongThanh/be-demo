import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library` — native Vite option, replaces the
  // vite-tsconfig-paths plugin.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/generated/**', 'src/main.ts'],
      // Sàn chống tụt coverage; nâng dần khi thêm test (hiện ~57%).
      thresholds: { lines: 50, functions: 50, branches: 50, statements: 50 },
    },
  },
});
