import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    globals: false,
    testTimeout: 15000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    setupFiles: ['./tests/setup.ts'],
  },
});
