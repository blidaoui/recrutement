import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
      environment: 'node',
      setupFiles: ['./tests/setup-env.js'],
      globalSetup: ['./tests/global-setup.js'],
      fileParallelism: false, // shared Postgres DB, so run files sequentially
      testTimeout: 15000,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        all: true,
        include: [
          'src/services/ia/**',
          'src/middleware/auth.js'
        ],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
      },
    },
  });