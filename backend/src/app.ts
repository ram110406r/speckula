import Fastify, { FastifyInstance } from 'fastify';
import cors from 'fastify-cors';
import fastifyJwt from 'fastify-jwt';
import fastifyWebsocket from 'fastify-websocket';
import pino from 'pino';

const logger = pino(
  process.env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
      }
    : undefined
);

export const createServer = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({ logger });

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
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok' };
  });

  // AI Routes
  fastify.register(async (fastify) => {
    const aiRoutes = (await import('./routes/aiRoutes.js')).default;
    await aiRoutes(fastify);
  }, { prefix: '/ai' });

  return fastify;
};

export default createServer;
