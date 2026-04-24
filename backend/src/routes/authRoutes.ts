import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { authMiddleware, asyncHandler } from '../lib/middleware';
import { sendSuccess, ValidationError } from '../lib/errors';
import { SignupSchema, LoginSchema, RefreshTokenSchema } from '../lib/schemas';

const router = Router();

/**
 * POST /auth/signup
 * Create a new user account
 */
router.post(
  '/signup',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = SignupSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    const { name, email, password } = parsed.data;
    const result = await authService.signup(name, email, password);

    sendSuccess(res, result, 201);
  })
);

/**
 * POST /auth/login
 * Authenticate user and return tokens
 */
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    const { email, password } = parsed.data;
    const result = await authService.login(email, password);

    sendSuccess(res, result);
  })
);

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = RefreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new ValidationError();
    }

    const result = await authService.refreshAccessToken(parsed.data.refreshToken, req.userId);

    sendSuccess(res, result);
  })
);

/**
 * GET /auth/me
 * Get current authenticated user
 */
router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const user = await authService.getCurrentUser(req.userId);

    sendSuccess(res, user);
  })
);

/**
 * POST /auth/logout
 * Logout user (revoke refresh token)
 */
router.post(
  '/logout',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new ValidationError();
    }

    await authService.logout(refreshToken);

    sendSuccess(res, { message: 'Logged out successfully' });
  })
);

export default router;
