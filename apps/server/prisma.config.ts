import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'prisma/config';

const envFile = resolve(import.meta.dirname, '../../.env');

if (existsSync(envFile)) {
  loadEnvFile(envFile);
}

const datasourceUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  ...(datasourceUrl ? { datasource: { url: datasourceUrl } } : {}),
});
