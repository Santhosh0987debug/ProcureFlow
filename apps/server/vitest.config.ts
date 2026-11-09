import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'vitest/config';

const envFile = resolve(process.cwd(), '../../.env');

if (existsSync(envFile)) {
  loadEnvFile(envFile);
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for API integration tests. Add it to the repository-root .env file and point it at a dedicated PostgreSQL test database.',
  );
}

if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL must point at a separate database from DATABASE_URL; tests truncate their schema.',
  );
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/test/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      JWT_SECRET: 'procureflow-test-only-jwt-secret-0123456789abcdef',
      JWT_ISSUER: 'procureflow-api',
      JWT_AUDIENCE: 'procureflow-web',
      COOKIE_SECURE: 'false',
      COOKIE_SAME_SITE: 'lax',
      AUTH_RATE_LIMIT_MAX: '1000',
    },
    fileParallelism: false,
    restoreMocks: true,
    clearMocks: true,
  },
});
