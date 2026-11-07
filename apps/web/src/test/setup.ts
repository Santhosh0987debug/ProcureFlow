import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

const healthResponse = {
  status: 'ok',
  service: 'procureflow-api',
  version: '0.1.0',
  environment: 'test',
  uptimeSeconds: 12,
  timestamp: new Date().toISOString(),
};

beforeEach(() => {
  window.localStorage.clear();

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => healthResponse,
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
