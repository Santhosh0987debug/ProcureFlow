import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { createFetchMock } from './api-mock';

// Cold jsdom renders of the full dashboard can exceed the 1s default on CI.
configure({ asyncUtilTimeout: 5_000 });

// Warm the lazily loaded dashboard module once per test file. Without this the
// first render races Testing Library's timeout against Vite's on-demand
// transform in cold CI runs.
await import('../pages/DashboardPage');

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('fetch', createFetchMock());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
