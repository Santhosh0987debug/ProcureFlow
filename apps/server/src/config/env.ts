import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import type { EnvironmentName } from '@procureflow/shared';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

/**
 * Support both source execution (`src/config`) and compiled execution (`dist/config`).
 * The first existing file wins; real process environment variables are never overwritten.
 */
const envFileCandidates = [
  resolve(moduleDirectory, '../../../../.env'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
];

for (const candidate of envFileCandidates) {
  if (existsSync(candidate)) {
    loadEnvFile(candidate);
    break;
  }
}

const allowedEnvironments: readonly EnvironmentName[] = ['development', 'test', 'production'];
const nodeEnv = (process.env.NODE_ENV ?? 'development') as EnvironmentName;

if (!allowedEnvironments.includes(nodeEnv)) {
  throw new Error(
    `Invalid NODE_ENV "${nodeEnv}". Expected one of: ${allowedEnvironments.join(', ')}.`,
  );
}

const port = Number(process.env.PORT ?? 4000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT "${process.env.PORT}". Expected an integer between 1 and 65535.`);
}

const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (corsOrigins.length === 0) {
  throw new Error('CORS_ORIGIN must contain at least one allowed origin.');
}

const version = process.env.APP_VERSION?.trim() || '0.1.0';

export const env = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port,
  corsOrigins,
  version,
  serviceName: 'procureflow-api',
  apiPrefix: '/api',
});

export type AppEnv = typeof env;
