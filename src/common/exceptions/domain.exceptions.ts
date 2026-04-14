import { AppError } from './base.error';

export class BadRequestError extends AppError {
  constructor(message: string, errorCode: string = 'BAD_REQUEST', details?: Record<string, any>) {
    super(message, 400, errorCode, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', errorCode: string = 'UNAUTHORIZED', details?: Record<string, any>) {
    super(message, 401, errorCode, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', errorCode: string = 'FORBIDDEN', details?: Record<string, any>) {
    super(message, 403, errorCode, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, errorCode: string = 'NOT_FOUND', details?: Record<string, any>) {
    super(message, 404, errorCode, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, errorCode: string = 'CONFLICT', details?: Record<string, any>) {
    super(message, 409, errorCode, details);
  }
}

export class InvalidTenantError extends AppError {
  constructor(tenantId: string) {
    super(
      `Tenant with ID '${tenantId}' is invalid or does not exist.`,
      400,
      'INVALID_TENANT',
      { tenantId }
    );
  }
}

export class TenantSuspendedError extends AppError {
  constructor(tenantId: string, reason?: string) {
    super(
      'This tenant account is suspended. Please contact support.',
      403,
      'TENANT_SUSPENDED',
      { tenantId, reason }
    );
  }
}
