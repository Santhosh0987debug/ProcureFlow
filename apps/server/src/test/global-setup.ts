import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

export default function globalSetup(): void {
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

  execSync('npx prisma migrate deploy', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl, NODE_ENV: 'test' },
    stdio: 'inherit',
    windowsHide: true,
  });
}
