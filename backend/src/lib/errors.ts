import { Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string = 'INTERNAL_SERVER_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(public details?: ZodError) {
    super(400, 'Validation failed', 'VALIDATION_ERROR');
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication failed') {
    super(401, message, 'AUTH_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(403, message, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

export const sendError = (res: Response, error: unknown) => {
  console.error('Error:', error);

  if (error instanceof ValidationError) {
    return res.status(error.statusCode).json({
      ok: false,
      code: error.code,
      message: error.message,
      details: error.details?.issues ?? [],
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      ok: false,
      code: error.code,
      message: error.message,
    });
  }

  const message = error instanceof Error ? error.message : 'Internal server error';
  res.status(500).json({
    ok: false,
    code: 'INTERNAL_SERVER_ERROR',
    message,
  });
};

export const sendSuccess = <T>(res: Response, data: T, statusCode = 200) => {
  res.status(statusCode).json({
    ok: true,
    data,
  });
};
