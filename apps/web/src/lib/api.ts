import type { ApiErrorResponse, ApiSuccessResponse } from '@procureflow/shared';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(message: string, options: { status: number; code: string; details?: unknown }) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, headers, ...requestInit } = options;
  const requestHeaders = new Headers(headers);

  requestHeaders.set('Accept', 'application/json');

  if (body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...requestInit,
    credentials: 'include',
    headers: requestHeaders,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
  const payload: unknown = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse | null;
    throw new ApiRequestError(
      errorPayload?.error?.message ?? 'The request could not be completed.',
      {
        status: response.status,
        code: errorPayload?.error?.code ?? 'REQUEST_FAILED',
        details: errorPayload?.error?.details,
      },
    );
  }

  return (payload as ApiSuccessResponse<T>).data;
}
