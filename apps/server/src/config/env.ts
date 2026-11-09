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

function requireString(name: string, minimumLength = 1): string {
  const value = process.env[name]?.trim();

  if (!value || value.length < minimumLength) {
    throw new Error(
      `${name} must be set to at least ${minimumLength} character${minimumLength === 1 ? '' : 's'}.`,
    );
  }

  return value;
}

function optionalString(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function readInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const rawValue = process.env[name]?.trim();
  const value = rawValue ? Number(rawValue) : fallback;

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `Invalid ${name} "${rawValue ?? fallback}". Expected an integer between ${minimum} and ${maximum}.`,
    );
  }

  return value;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const rawValue = process.env[name]?.trim().toLowerCase();

  if (rawValue === undefined || rawValue === '') {
    return fallback;
  }

  if (['1', 'true', 'yes', 'on'].includes(rawValue)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(rawValue)) {
    return false;
  }

  throw new Error(`Invalid ${name} "${rawValue}". Expected true or false.`);
}

const allowedEnvironments: readonly EnvironmentName[] = ['development', 'test', 'production'];
const nodeEnv = (process.env.NODE_ENV ?? 'development') as EnvironmentName;

if (!allowedEnvironments.includes(nodeEnv)) {
  throw new Error(
    `Invalid NODE_ENV "${nodeEnv}". Expected one of: ${allowedEnvironments.join(', ')}.`,
  );
}

const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const port = readInteger('PORT', 4000, 1, 65535);
const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (corsOrigins.length === 0) {
  throw new Error('CORS_ORIGIN must contain at least one allowed origin.');
}

const cookieSameSite = (process.env.COOKIE_SAME_SITE?.trim().toLowerCase() ?? 'lax') as
  'lax' | 'strict' | 'none';

if (!['lax', 'strict', 'none'].includes(cookieSameSite)) {
  throw new Error('Invalid COOKIE_SAME_SITE. Expected one of: lax, strict, none.');
}

const cookieSecure = readBoolean('COOKIE_SECURE', isProduction);

if (cookieSameSite === 'none' && !cookieSecure) {
  throw new Error('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true.');
}

const version = process.env.APP_VERSION?.trim() || '0.2.0';
const jwtSecret = requireString('JWT_SECRET', 32);
const databaseUrl = requireString('DATABASE_URL');

export const env = Object.freeze({
  nodeEnv,
  isDevelopment: nodeEnv === 'development',
  isTest,
  isProduction,
  port,
  corsOrigins,
  version,
  serviceName: 'procureflow-api',
  apiPrefix: '/api',
  databaseUrl,
  jwtSecret,
  jwtIssuer: optionalString('JWT_ISSUER') ?? 'procureflow-api',
  jwtAudience: optionalString('JWT_AUDIENCE') ?? 'procureflow-web',
  sessionTtlHours: readInteger('SESSION_TTL_HOURS', 168, 1, 720),
  cookieName: optionalString('COOKIE_NAME') ?? 'procureflow_session',
  cookieDomain: optionalString('COOKIE_DOMAIN'),
  cookieSecure,
  cookieSameSite,
  bcryptRounds: readInteger('BCRYPT_ROUNDS', 12, 10, 15),
  authRateLimitWindowMinutes: readInteger('AUTH_RATE_LIMIT_WINDOW_MINUTES', 15, 1, 1440),
  authRateLimitMax: readInteger('AUTH_RATE_LIMIT_MAX', isTest ? 1000 : 20, 1, 100_000),
  trustProxy: readInteger('TRUST_PROXY', 0, 0, 10),
});

export type AppEnv = typeof env;
