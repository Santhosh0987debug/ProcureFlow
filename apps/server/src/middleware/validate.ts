import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error.js';

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};

      for (const issue of result.error.issues) {
        const field = issue.path.length > 0 ? issue.path.join('.') : 'form';
        (fieldErrors[field] ??= []).push(issue.message);
      }

      next(
        new AppError('Please correct the highlighted fields.', {
          statusCode: 422,
          code: 'VALIDATION_ERROR',
          details: { fieldErrors },
        }),
      );
      return;
    }

    request.body = result.data;
    next();
  };
}
