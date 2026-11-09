import type { Request } from 'express';
import { AppError } from '../errors/app-error.js';
import type { AuthenticatedUser } from '../types/auth.js';

export function requireAuthenticatedUser(request: Request): AuthenticatedUser {
  const user = request.auth?.user;

  if (!user) {
    throw new AppError('Authentication is required to access this resource.', {
      statusCode: 401,
      code: 'AUTH_REQUIRED',
    });
  }

  return user;
}
