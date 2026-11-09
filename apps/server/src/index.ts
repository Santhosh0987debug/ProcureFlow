import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(
    `[procureflow] ${env.serviceName} listening on http://localhost:${env.port}${env.apiPrefix}/health (${env.nodeEnv})`,
  );
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`[procureflow] ${signal} received. Closing the API server.`);

  server.close((error) => {
    if (error) {
      console.error('[procureflow] Failed to close the API server cleanly.', error);
      process.exitCode = 1;
    }

    void prisma
      .$disconnect()
      .catch((disconnectError: unknown) => {
        console.error('[procureflow] Failed to disconnect from PostgreSQL.', disconnectError);
        process.exitCode = 1;
      })
      .finally(() => {
        process.exit();
      });
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
