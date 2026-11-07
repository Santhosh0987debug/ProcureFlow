import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(
    `[procureflow] ${env.serviceName} listening on http://localhost:${env.port}${env.apiPrefix}/health (${env.nodeEnv})`,
  );
});

function shutdown(signal: string): void {
  console.log(`[procureflow] ${signal} received. Closing the API server.`);
  server.close((error) => {
    if (error) {
      console.error('[procureflow] Failed to close the API server cleanly.', error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
