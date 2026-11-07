interface AppErrorOptions {
  statusCode?: number;
  code?: string;
  details?: unknown;
  isOperational?: boolean;
}

/**
 * Expected, operational API failures carry a stable code and HTTP status.
 * Unexpected failures are converted to a generic 500 by the error middleware.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;
  readonly isOperational: boolean;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? 'INTERNAL_ERROR';
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;

    Error.captureStackTrace?.(this, AppError);
  }
}
