import type { ApiHealthResponse } from '@procureflow/shared';
import { env } from '../config/env.js';

export function getHealthStatus(): ApiHealthResponse {
  return {
    status: 'ok',
    service: env.serviceName,
    version: env.version,
    environment: env.nodeEnv,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}
