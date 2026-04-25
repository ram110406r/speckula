import Fastify from 'fastify';
import cors from '@fastify/cors';
import aiRoutes from './routes/aiRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import importRoutes from './routes/importRoutes.js';

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

  // Normalize any unhandled error into the `{ ok, error }` envelope the frontend expects.
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    reply.code(status).send({ ok: false, error: error.message });
  });

  fastify.get('/health', async () => ({ status: 'ok' }));

  await fastify.register(aiRoutes, { prefix: '/ai' });
  await fastify.register(chatRoutes, { prefix: '/ai' });
  await fastify.register(importRoutes, { prefix: '/import' });

  return fastify;
};

export default createServer;
