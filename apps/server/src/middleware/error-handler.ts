import type { ErrorRequestHandler } from 'express';
import type { ApiErrorResponse } from '@procureflow/shared';
import { AppError } from '../errors/app-error.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const isOperationalError = error instanceof AppError;
  const statusCode = isOperationalError ? error.statusCode : 500;
  const code = isOperationalError ? error.code : 'INTERNAL_ERROR';
  const message = isOperationalError ? error.message : 'An unexpected error occurred.';

  if (!isOperationalError || statusCode >= 500) {
    console.error('[procureflow:error]', error);
  }

  const body: ApiErrorResponse = {
    error: {
      code,
      message,
      ...(isOperationalError && error.details !== undefined ? { details: error.details } : {}),
    },
  };

  response.status(statusCode).json(body);
};
