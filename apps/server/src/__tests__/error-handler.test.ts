import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/app-error.js';
import { errorHandler } from '../middleware/error-handler.js';
import { notFoundHandler } from '../middleware/not-found.js';

function createErrorApp() {
  const app = express();
  app.get('/conflict', () => {
    throw new AppError('A duplicate record already exists.', {
      statusCode: 409,
      code: 'DUPLICATE_RECORD',
      details: { field: 'reference' },
    });
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('centralized error middleware', () => {
  it('serializes operational errors with their status and code', async () => {
    const response = await request(createErrorApp()).get('/conflict');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: 'DUPLICATE_RECORD',
        message: 'A duplicate record already exists.',
        details: { field: 'reference' },
      },
    });
  });
});
