// Custom error classes for DCMS

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', {
      retryAfter,
    });
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(`${service} service error: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', {
      service,
    });
  }
}

export class AIServiceError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`AI Classification error: ${message}`, 500, 'AI_SERVICE_ERROR', details);
  }
}

export class WebhookError extends AppError {
  constructor(message: string) {
    super(message, 400, 'WEBHOOK_ERROR');
  }
}

// Error handler helper
export const handleDatabaseError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  const err = error as { code?: string; message?: string };

  // PostgreSQL error codes
  switch (err.code) {
    case '23505': // unique_violation
      return new ConflictError('A record with this value already exists');
    case '23503': // foreign_key_violation
      return new ValidationError('Referenced record does not exist');
    case '23502': // not_null_violation
      return new ValidationError('Required field is missing');
    case '42P01': // undefined_table
      return new AppError('Database configuration error', 500, 'DATABASE_ERROR');
    default:
      return new AppError(
        err.message || 'Database operation failed',
        500,
        'DATABASE_ERROR'
      );
  }
};
