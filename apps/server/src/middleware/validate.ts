import type { RequestHandler } from 'express';
import type { ZodError, ZodType } from 'zod';
import { AppError } from '../errors/app-error.js';

function validationError(error: ZodError): AppError {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.join('.') : 'form';
    (fieldErrors[field] ??= []).push(issue.message);
  }

  return new AppError('Please correct the highlighted fields.', {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
    details: { fieldErrors },
  });
}

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      next(validationError(result.error));
      return;
    }

    request.body = result.data;
    next();
  };
}

export function validateParams<T>(schema: ZodType<T>): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.params);

    if (!result.success) {
      next(validationError(result.error));
      return;
    }

    request.params = result.data as typeof request.params;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.query);

    if (!result.success) {
      next(validationError(result.error));
      return;
    }

    request.validatedQuery = result.data;
    next();
  };
}
