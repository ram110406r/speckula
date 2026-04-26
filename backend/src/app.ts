import Fastify, { FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import aiRoutes from './routes/aiRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import importRoutes from './routes/importRoutes.js';
import slackRoutes from './routes/slackRoutes.js';
import slackOAuthRoutes from './routes/slackOAuthRoutes.js';

export const createServer = async () => {
  const fastify = Fastify({
    logger:
      process.env.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true },
            },
          }
        : true,
  });

  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  await fastify.register(rateLimit, {
    global: false,
    keyGenerator: (req: FastifyRequest) =>
      (req as FastifyRequest & { userId?: string }).userId || req.ip,
    errorResponseBuilder: (_req, ctx) => ({
      ok: false,
      error: `Rate limit exceeded — ${ctx.max} requests per hour. Retry after ${Math.ceil(ctx.ttl / 1000)}s.`,
    }),
  });

  // Normalize any unhandled error into the `{ ok, error }` envelope the frontend expects.
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    reply.code(status).send({ ok: false, error: error.message });
  });

  fastify.get('/health', async () => ({ status: 'ok' }));

  // AI routes get rate-limited (100 req/hr per user) to cap Groq spend per account.
  await fastify.register(
    async (instance) => {
      instance.addHook('onRoute', (route) => {
        route.config = { ...(route.config || {}), rateLimit: { max: 100, timeWindow: '1 hour' } };
      });
      await instance.register(aiRoutes);
      await instance.register(chatRoutes);
    },
    { prefix: '/ai' }
  );
  await fastify.register(importRoutes, { prefix: '/import' });
  await fastify.register(slackRoutes, { prefix: '/slack' });
  await fastify.register(slackOAuthRoutes, { prefix: '/auth/slack' });

  return fastify;
};

export default createServer;
