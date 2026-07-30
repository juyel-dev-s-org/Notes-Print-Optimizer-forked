import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.bench.ts'],
    exclude: ['tests/smoke/**', 'node_modules/**'],
    setupFiles: ['./tests/setup.ts'],
    benchmark: {
      reporters: ['default'],
      outputJson: 'tests/benchmarks/results.json',
    },
  },
});
