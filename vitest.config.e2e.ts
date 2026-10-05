import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      JWT_ACCESS_SECRET: 'e2e-test-secret-that-is-at-least-32-chars',
    },
    globalSetup: ['./test/global-setup.ts'],
    // Pulling and booting the database container can be slow on first run.
    hookTimeout: 120_000,
  },
});
