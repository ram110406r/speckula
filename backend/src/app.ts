import express, { Express } from 'express';
import cors from 'cors';
import 'express-async-errors';
import { errorHandler, notFoundHandler, asyncHandler } from './lib/middleware';
import { sendSuccess } from './lib/errors';

// Routes
import authRoutes from './routes/authRoutes';
import workspaceRoutes from './routes/workspaceRoutes';
import thinkingRoutes from './routes/thinkingRoutes';
import decisionRoutes from './routes/decisionRoutes';
import buildRoutes from './routes/buildRoutes';
import aiRoutes from './routes/aiRoutes';

const createApp = (): Express => {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Health check
  app.get(
    '/health',
    asyncHandler(async (req, res) => {
      sendSuccess(res, { status: 'ok' });
    })
  );

  // API Routes
  app.use('/auth', authRoutes);
  app.use('/workspace', workspaceRoutes);
  app.use('/notes', thinkingRoutes);
  app.use('/insights', thinkingRoutes); // Insights use the same router
  app.use('/decision', decisionRoutes);
  app.use('/prd', buildRoutes);
  app.use('/task', buildRoutes); // Tasks use the same router
  app.use('/ai', aiRoutes);

  // 404 Handler
  app.use(notFoundHandler);

  // Global Error Handler (must be last)
  app.use(errorHandler);

  return app;
};

export default createApp;
