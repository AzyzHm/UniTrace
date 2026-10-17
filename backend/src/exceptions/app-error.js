export class AppError extends Error {
  constructor(message, { statusCode, code, details = [] }) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid input', details = []) {
    super(message, { statusCode: 400, code: 'VALIDATION_ERROR', details });
  }
}

export class InvalidCodeError extends AppError {
  constructor(message = 'Invalid or expired code') {
    super(message, { statusCode: 400, code: 'INVALID_CODE' });
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, { statusCode: 401, code: 'UNAUTHENTICATED' });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You are not allowed to do this') {
    super(message, { statusCode: 403, code: 'FORBIDDEN' });
  }
}

export class EmailNotVerifiedError extends AppError {
  constructor(message = 'Email address is not verified') {
    super(message, { statusCode: 403, code: 'EMAIL_NOT_VERIFIED' });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, { statusCode: 404, code: 'NOT_FOUND' });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details = []) {
    super(message, { statusCode: 409, code: 'CONFLICT', details });
  }
}

export class FileTooLargeError extends AppError {
  constructor(message = 'File is too large') {
    super(message, { statusCode: 413, code: 'FILE_TOO_LARGE' });
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Too many requests', { retryAfterSeconds } = {}) {
    super(message, { statusCode: 429, code: 'RATE_LIMITED' });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
