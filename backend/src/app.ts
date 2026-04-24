import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyWebsocket from '@fastify/websocket';
import aiRoutes from './routes/aiRoutes.js';

export const createServer = async () => {
  const fastify = Fastify({
    logger:
      process.env.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
              },
            },
          }
        : true,
  });

  // Plugins
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  await fastify.register(fastifyJwt, {
    secret: process.env.FIREBASE_PRIVATE_KEY || 'your-secret-key',
  });

  await fastify.register(fastifyWebsocket);

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // AI Routes
  await fastify.register(aiRoutes, { prefix: '/ai' });

  return fastify;
};

export default createServer;
