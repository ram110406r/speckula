import Fastify, { FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import aiRoutes from './routes/aiRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import importRoutes from './routes/importRoutes.js';
import slackRoutes from './routes/slackRoutes.js';
import slackOAuthRoutes from './routes/slackOAuthRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import userRoutes from './routes/userRoutes.js';
import extensionRoutes from './routes/extensionRoutes.js';
import websocketRoutes from './routes/websocketRoutes.js';
import productBrainRoutes from './routes/productBrainRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import marketRoutes from './routes/marketRoutes.js';
import competitorRoutes from './routes/competitorRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import { verifyFirebaseAuth } from './lib/firebaseAuth.js';
import { validateEnv } from './lib/env.js';
import { startAnalysisWorker } from './workers/analysisWorker.js';
import { wsManager } from './services/websocketManager.js';

const parseOriginList = (raw: string | undefined): string[] | null => {
  if (!raw) return null;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : null;
};

export const createServer = async () => {
  const env = validateEnv();
  const isProd = env.NODE_ENV === 'production';

  const fastify = Fastify({
    logger: isProd
      ? { level: 'info' }
      : { level: 'debug', transport: { target: 'pino-pretty', options: { colorize: true } } },
    bodyLimit: 2 * 1024 * 1024,
    genReqId: () => crypto.randomUUID(),
  });

  // ── Security headers ───────────────────────────────────────────────────────
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  // ── CORS ───────────────────────────────────────────────────────────────────
  const originList =
    parseOriginList(process.env.FRONTEND_URLS) ??
    parseOriginList(process.env.FRONTEND_URL) ??
    ['http://localhost:3000'];

  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (originList.includes(origin)) return cb(null, true);
      cb(new Error('CORS: origin not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  // ── Rate limiting ──────────────────────────────────────────────────────────
  await fastify.register(rateLimit, {
    global: false,
    hook: 'preHandler',
    keyGenerator: (req: FastifyRequest) => {
      const uid = (req as FastifyRequest & { userId?: string }).userId;
      return uid ? `u:${uid}` : `ip:${req.ip}`;
    },
    errorResponseBuilder: (_req, ctx) => ({
      ok: false,
      error: `Rate limit exceeded — ${ctx.max} requests per hour. Retry after ${Math.ceil(ctx.ttl / 1000)}s.`,
    }),
  });

  // ── WebSocket plugin ───────────────────────────────────────────────────────
  await fastify.register(websocket);

  // ── Global hooks ──────────────────────────────────────────────────────────
  fastify.addHook('onRequest', async (request) => {
    (request as FastifyRequest & { startTime?: number }).startTime = Date.now();
  });

  fastify.addHook('onSend', async (request, reply) => {
    const start = (request as FastifyRequest & { startTime?: number }).startTime;
    if (typeof start === 'number') {
      reply.header('X-Response-Time', `${Date.now() - start}ms`);
    }
  });

  // ── Error handler ──────────────────────────────────────────────────────────
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error({ err: error, requestId: request.id }, 'Request error');
    const status = (() => {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        const code = (error as { statusCode?: unknown }).statusCode;
        if (typeof code === 'number' && code >= 400) return code;
      }
      return 500;
    })();
    const message =
      isProd && status >= 500
        ? 'Internal server error'
        : error instanceof Error
          ? error.message
          : 'Unknown error';
    reply
      .code(status)
      .header('X-Request-ID', request.id)
      .send({ ok: false, error: message, requestId: request.id });
  });

  // ── Health check — no auth ─────────────────────────────────────────────────
  await fastify.register(healthRoutes);

  // ── WebSocket gateway — token auth on connection ───────────────────────────
  await fastify.register(websocketRoutes);

  // ── Authenticated route groups ─────────────────────────────────────────────

  // AI routes: 100 req/hr per user.
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', verifyFirebaseAuth);
      instance.addHook('onRoute', (route) => {
        if (!route.config?.rateLimit) {
          route.config = { ...(route.config || {}), rateLimit: { max: 100, timeWindow: '1 hour' } };
        }
      });
      await instance.register(aiRoutes);
      await instance.register(chatRoutes);
    },
    { prefix: '/ai' }
  );

  // Import routes: tighter limit (outbound HTTP on user's behalf).
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

  // Extension routes: higher rate limit for heartbeats (frequent calls).
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', verifyFirebaseAuth);
      instance.addHook('onRoute', (route) => {
        const isHeartbeat = (route.url ?? '').includes('/heartbeat');
        route.config = {
          ...(route.config || {}),
          rateLimit: isHeartbeat
            ? { max: 200, timeWindow: '1 hour' }   // heartbeat: generous
            : { max: 60,  timeWindow: '1 hour' },  // analysis: 1/min
        };
      });
      await instance.register(extensionRoutes);
    },
    { prefix: '/extension' }
  );

  // Product Brain routes: 200 req/hr.
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', verifyFirebaseAuth);
      instance.addHook('onRoute', (route) => {
        route.config = { ...(route.config || {}), rateLimit: { max: 200, timeWindow: '1 hour' } };
      });
      await instance.register(productBrainRoutes);
    },
    { prefix: '/product-brain' }
  );

  // Notification routes.
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', verifyFirebaseAuth);
      instance.addHook('onRoute', (route) => {
        route.config = { ...(route.config || {}), rateLimit: { max: 200, timeWindow: '1 hour' } };
      });
      await instance.register(notificationRoutes);
    },
    { prefix: '/notifications' }
  );

  // Analytics routes.
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', verifyFirebaseAuth);
      instance.addHook('onRoute', (route) => {
        route.config = { ...(route.config || {}), rateLimit: { max: 60, timeWindow: '1 hour' } };
      });
      await instance.register(analyticsRoutes);
    },
    { prefix: '/analytics' }
  );

  // Market signal routes: 60 req/hr.
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', verifyFirebaseAuth);
      instance.addHook('onRoute', (route) => {
        route.config = { ...(route.config || {}), rateLimit: { max: 60, timeWindow: '1 hour' } };
      });
      await instance.register(marketRoutes);
    },
    { prefix: '/market' }
  );

  // Competitor intelligence routes: 60 req/hr.
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', verifyFirebaseAuth);
      instance.addHook('onRoute', (route) => {
        route.config = { ...(route.config || {}), rateLimit: { max: 60, timeWindow: '1 hour' } };
      });
      await instance.register(competitorRoutes);
    },
    { prefix: '/competitors' }
  );

  // Agent status routes: 60 req/hr.
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', verifyFirebaseAuth);
      instance.addHook('onRoute', (route) => {
        route.config = { ...(route.config || {}), rateLimit: { max: 60, timeWindow: '1 hour' } };
      });
      await instance.register(agentRoutes);
    },
    { prefix: '/agents' }
  );

  // User routes: low limit (destructive operations).
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', verifyFirebaseAuth);
      instance.addHook('onRoute', (route) => {
        route.config = { ...(route.config || {}), rateLimit: { max: 10, timeWindow: '1 hour' } };
      });
      await instance.register(userRoutes);
    },
    { prefix: '/user' }
  );

  await fastify.register(slackRoutes,      { prefix: '/slack' });
  await fastify.register(slackOAuthRoutes, { prefix: '/auth/slack' });

  // ── Embedded analysis worker (development / small deployments) ─────────────
  // In production the worker container runs as a separate process.
  // To embed: set EMBEDDED_WORKER=true in the backend env.
  if (process.env.EMBEDDED_WORKER === 'true') {
    startAnalysisWorker();
    fastify.log.info('[app] Embedded analysis worker started');
  }

  // Sweep stale WebSocket connection DB rows every 5 minutes.
  setInterval(() => {
    wsManager.sweepStale().catch(() => undefined);
  }, 5 * 60 * 1000);

  return fastify;
};

export default createServer;
