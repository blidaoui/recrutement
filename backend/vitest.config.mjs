import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup-env.js'],
    globalSetup: ['./tests/global-setup.js'],
    fileParallelism: false, // shared Postgres DB, so run files sequentially
    testTimeout: 15000,
  },
});