import { Currency, WorkspaceRole } from '@procureflow/shared';
import type { AuthSession } from '@procureflow/shared';
import { vi } from 'vitest';

export const testSession: AuthSession = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'amara.okafor@northwind.example',
    firstName: 'Amara',
    lastName: 'Okafor',
    jobTitle: 'Head of Procurement',
    avatarUrl: null,
    createdAt: '2025-09-15T09:00:00.000Z',
  },
  workspaces: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Northwind Industrial',
      slug: 'northwind-industrial',
      role: WorkspaceRole.Owner,
      currency: Currency.USD,
    },
  ],
};

const healthResponse = {
  status: 'ok',
  service: 'procureflow-api',
  version: '0.2.0',
  environment: 'test',
  uptimeSeconds: 12,
  timestamp: new Date().toISOString(),
};

export function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  };
}

export function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return jsonResponse(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    status,
  );
}

interface FetchMockOptions {
  authenticated?: boolean;
  session?: AuthSession;
  loginResponse?: { status: number; body: unknown };
  registerResponse?: { status: number; body: unknown };
}

export function createFetchMock(options: FetchMockOptions = {}) {
  const { authenticated = true, session = testSession } = options;

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();

    if (url.endsWith('/api/health')) {
      return jsonResponse(healthResponse);
    }

    if (url.endsWith('/api/auth/me')) {
      return authenticated
        ? jsonResponse({ data: session })
        : errorResponse(
            401,
            'AUTH_REQUIRED',
            'Authentication is required to access this resource.',
          );
    }

    if (url.endsWith('/api/auth/login') && method === 'POST') {
      return options.loginResponse
        ? jsonResponse(options.loginResponse.body, options.loginResponse.status)
        : jsonResponse({ data: session });
    }

    if (url.endsWith('/api/auth/register') && method === 'POST') {
      return options.registerResponse
        ? jsonResponse(options.registerResponse.body, options.registerResponse.status)
        : jsonResponse({ data: session }, 201);
    }

    if (url.endsWith('/api/auth/logout') && method === 'POST') {
      return {
        ok: true,
        status: 204,
        headers: new Headers(),
        json: async () => null,
      };
    }

    return errorResponse(404, 'NOT_FOUND', 'The requested resource was not found.');
  });
}
