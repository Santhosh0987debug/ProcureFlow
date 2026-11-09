import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

const globalForPrisma = globalThis as unknown as { procureflowPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.procureflowPrisma ??
  new PrismaClient({
    datasourceUrl: env.databaseUrl,
    log: env.isDevelopment ? ['warn', 'error'] : ['error'],
  });

if (!env.isProduction) {
  globalForPrisma.procureflowPrisma = prisma;
}
