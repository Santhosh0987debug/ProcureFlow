import { ApiRequestError } from './api';

export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!(error instanceof ApiRequestError) || !error.details || typeof error.details !== 'object') {
    return {};
  }

  const fieldErrors = (error.details as { fieldErrors?: unknown }).fieldErrors;

  if (!fieldErrors || typeof fieldErrors !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? String(messages[0] ?? '') : String(messages ?? ''),
    ]),
  );
}

export function messageFrom(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  return 'We could not reach the ProcureFlow API. Please check your connection and try again.';
}
