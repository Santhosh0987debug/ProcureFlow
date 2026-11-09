import type { ApiErrorResponse } from '@procureflow/shared';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const authRateLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMinutes * 60 * 1000,
  limit: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_request, response) => {
    const body: ApiErrorResponse = {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many authentication attempts. Please wait a few minutes and try again.',
      },
    };

    response.status(429).json(body);
  },
});
