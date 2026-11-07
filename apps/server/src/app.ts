import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { AppError } from './errors/app-error.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(
          new AppError('The request origin is not allowed.', {
            statusCode: 403,
            code: 'CORS_ORIGIN_DENIED',
          }),
        );
      },
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use(env.apiPrefix, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
