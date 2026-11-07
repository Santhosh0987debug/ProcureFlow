import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

const app = createApp();

describe('GET /api/health', () => {
  it('reports API health and environment metadata', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'procureflow-api',
      environment: 'test',
    });
    expect(typeof response.body.version).toBe('string');
    expect(typeof response.body.uptimeSeconds).toBe('number');
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });

  it('allows the configured development origin', async () => {
    const response = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});

describe('API error handling', () => {
  it('returns a consistent JSON payload for unknown routes', async () => {
    const response = await request(app).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Route GET /api/does-not-exist was not found.',
      },
    });
  });
});
