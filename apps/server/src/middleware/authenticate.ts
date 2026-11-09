import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';
import { verifySessionToken } from '../lib/session-token.js';

export const authenticate: RequestHandler = async (request, _response, next) => {
  const token: unknown = request.cookies?.[env.cookieName];

  if (typeof token !== 'string' || token.length === 0) {
    next(
      new AppError('Authentication is required to access this resource.', {
        statusCode: 401,
        code: 'AUTH_REQUIRED',
      }),
    );
    return;
  }

  const payload = await verifySessionToken(token);

  if (!payload) {
    next(
      new AppError('Your session has expired. Please sign in again.', {
        statusCode: 401,
        code: 'SESSION_INVALID',
      }),
    );
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      memberships: {
        include: { workspace: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!user) {
    next(
      new AppError('Your session is no longer valid. Please sign in again.', {
        statusCode: 401,
        code: 'SESSION_INVALID',
      }),
    );
    return;
  }

  request.auth = { user };
  next();
};
