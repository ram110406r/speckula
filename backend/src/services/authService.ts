import { db } from '../lib/db';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
} from '../lib/auth';
import {
  ConflictError,
  AuthError,
  NotFoundError,
} from '../lib/errors';

export const authService = {
  /**
   * User signup
   */
  async signup(name: string, email: string, password: string) {
    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
    });

    // Store refresh token in DB
    await db.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      accessToken,
      refreshToken,
    };
  },

  /**
   * User login
   */
  async login(email: string, password: string) {
    // Find user
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AuthError('Invalid email or password');
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AuthError('Invalid email or password');
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
    });

    // Store refresh token in DB
    await db.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      accessToken,
      refreshToken,
    };
  },

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string, userId: string) {
    // Verify refresh token exists and hasn't expired
    const tokenRecord = await db.refreshToken.findFirst({
      where: {
        token: refreshToken,
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!tokenRecord) {
      throw new AuthError('Invalid or expired refresh token');
    }

    // Get user
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    return {
      accessToken: newAccessToken,
    };
  },

  /**
   * Get current user
   */
  async getCurrentUser(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  },

  /**
   * Logout (revoke refresh token)
   */
  async logout(refreshToken: string) {
    await db.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  },
};
