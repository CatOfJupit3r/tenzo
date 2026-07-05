import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const alias = {
  '@~': path.resolve(__dirname, './src'),
};

const commonTestConfig = {
  globals: true,
  environment: 'node',
  clearMocks: true,
  restoreMocks: true,
  mockReset: true,
  watchExclude: ['mongo/**', 'dist/**', '.vitest/**'],
  env: {
    NODE_ENV: 'test',
    BETTER_AUTH_SECRET: 'test-secret',
    BETTER_AUTH_URL: 'http://localhost:3000/auth',
    VALKEY_HOST: 'localhost',
    VALKEY_PORT: '6379',
    MONGO_USER: 'username',
    MONGO_PASSWORD: 'password',
    MONGO_DATABASE_NAME: 'startername-test',
    LOG_LEVEL: 'error',
  },
  coverage: {
    provider: 'v8' as const,
    reporter: ['text', 'json', 'html'],
    exclude: ['node_modules', 'dist', 'test', '**/*.test.ts', '**/*.config.ts'],
    statements: 70,
    branches: 70,
    functions: 70,
    lines: 70,
  },
};

const baseProjectConfig = {
  plugins: [swc.vite({ tsconfigFile: './tsconfig.json' })],
  resolve: {
    alias,
  },
  cacheDir: 'node_modules/.vitest',
};

export default defineConfig({
  ...baseProjectConfig,
  test: {
    ...commonTestConfig,
    include: ['test/**/*.test.ts'],
    projects: [
      {
        ...baseProjectConfig,
        test: {
          ...commonTestConfig,
          name: 'unit',
          include: ['test/unit/**/*.test.ts', 'test/**/*.unit.test.ts'],
          exclude: ['test/integration/**', 'test/**/*.int.test.ts'],
          setupFiles: ['./test/helpers/matchers.ts'],
          isolate: true,
        },
      },
      {
        ...baseProjectConfig,
        test: {
          ...commonTestConfig,
          name: 'integration',
          include: ['test/**/*.test.ts'],
          exclude: ['test/unit/**', 'test/**/*.unit.test.ts'],
          globalSetup: ['./test/global-setup.ts'],
          setupFiles: ['./test/helpers/setup.ts'],
          testTimeout: 10000,
          hookTimeout: 10000,
          isolate: false,
        },
      },
    ],
  },
});
