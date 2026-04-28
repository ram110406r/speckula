import Fastify, { FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import aiRoutes from './routes/aiRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import importRoutes from './routes/importRoutes.js';
import slackRoutes from './routes/slackRoutes.js';
import slackOAuthRoutes from './routes/slackOAuthRoutes.js';
import { verifyFirebaseAuth } from './lib/firebaseAuth.js';
import { db } from './lib/db.js';
import { getFirebaseApp } from './lib/firebaseAdmin.js';

const parseOriginList = (raw: string | undefined): string[] | null => {
  if (!raw) return null;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : null;
};

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
    bodyLimit: 2 * 1024 * 1024, // 2 MB; multipart routes set their own limit.
  });

  // CORS allow-list. FRONTEND_URLS (comma-separated) wins; FRONTEND_URL is
  // kept for backwards compatibility with single-origin deployments.
  const originList =
    parseOriginList(process.env.FRONTEND_URLS) ??
    parseOriginList(process.env.FRONTEND_URL) ??
    ['http://localhost:3000'];
  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin / curl
      if (originList.includes(origin)) return cb(null, true);
      cb(new Error('Origin not allowed'), false);
    },
    credentials: true,
  });

  // Rate limit fires at preHandler so that any onRequest auth hook has a
  // chance to populate request.userId first. Without this, the keyGenerator
  // would fall back to req.ip and the per-user 100/hr cap would not apply.
  await fastify.register(rateLimit, {
    global: false,
    hook: 'preHandler',
    keyGenerator: (req: FastifyRequest) => {
      const uid = (req as FastifyRequest & { userId?: string }).userId;
      // userId-keyed when authed; IP-keyed for unauthenticated paths so
      // that a single client cannot overrun the limit by rotating tokens.
      return uid ? `u:${uid}` : `ip:${req.ip}`;
    },
    errorResponseBuilder: (_req, ctx) => ({
      ok: false,
      error: `Rate limit exceeded — ${ctx.max} requests per hour. Retry after ${Math.ceil(ctx.ttl / 1000)}s.`,
    }),
  });

  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    // In production avoid leaking validation/Prisma internals; in dev
    // surface the full message so route bugs are debuggable.
    const message =
      process.env.NODE_ENV === 'production' && status >= 500
        ? 'Internal server error'
        : error.message;
    reply.code(status).send({ ok: false, error: message });
  });

  // Health probes the DB and Firebase Admin so a pod with broken
  // dependencies fails its liveness/readiness check.
  fastify.get('/health', async (_req, reply) => {
    const checks: Record<string, 'ok' | 'fail'> = { server: 'ok' };
    try {
      await db.$queryRaw`SELECT 1`;
      checks.db = 'ok';
    } catch {
      checks.db = 'fail';
    }
    try {
      getFirebaseApp();
      checks.firebase = 'ok';
    } catch {
      checks.firebase = 'fail';
    }
    const allOk = Object.values(checks).every((v) => v === 'ok');
    reply.code(allOk ? 200 : 503).send({ status: allOk ? 'ok' : 'degraded', checks });
  });

  // AI routes: auth on onRequest (so rate-limit can key by userId), and
  // rate-limit at preHandler (configured globally above) capped at 100/hr/user.
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', verifyFirebaseAuth);
      instance.addHook('onRoute', (route) => {
        route.config = { ...(route.config || {}), rateLimit: { max: 100, timeWindow: '1 hour' } };
      });
      await instance.register(aiRoutes);
      await instance.register(chatRoutes);
    },
    { prefix: '/ai' }
  );

  // Import routes: same pattern — auth first, then a tighter rate-limit,
  // because /import/* makes outbound HTTP requests on the user's behalf.
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', verifyFirebaseAuth);
      instance.addHook('onRoute', (route) => {
        route.config = { ...(route.config || {}), rateLimit: { max: 30, timeWindow: '1 hour' } };
      });
      await instance.register(importRoutes);
    },
    { prefix: '/import' }
  );

  await fastify.register(slackRoutes, { prefix: '/slack' });
  await fastify.register(slackOAuthRoutes, { prefix: '/auth/slack' });

  return fastify;
};

export default createServer;
