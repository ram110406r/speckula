import { Request, Response, NextFunction } from 'express';
import { extractTokenFromHeader, verifyAccessToken } from './auth';
import { AuthError, sendError } from './errors';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      email?: string;
    }
  }
}

/**
 * Middleware: Authentication (JWT)
 * Extracts and verifies JWT token from Authorization header
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      throw new AuthError('No token provided');
    }

    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.email = payload.email;
    
    next();
  } catch (error) {
    if (error instanceof Error && error.message.includes('jwt')) {
      return sendError(res, new AuthError('Invalid or expired token'));
    }
    sendError(res, error);
  }
};

/**
 * Middleware: Error handling wrapper for async routes
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Middleware: Global error handler (must be last)
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  sendError(res, err);
};

/**
 * Middleware: 404 handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    ok: false,
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
};
