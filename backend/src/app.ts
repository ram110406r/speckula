import Fastify, { FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import aiRoutes from './routes/aiRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import importRoutes from './routes/importRoutes.js';
import slackRoutes from './routes/slackRoutes.js';
import slackOAuthRoutes from './routes/slackOAuthRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import { verifyFirebaseAuth } from './lib/firebaseAuth.js';
import { validateEnv } from './lib/env.js';

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
      // Production: raw JSON to stdout, consumed by log aggregator.
      ? { level: 'info' }
      // Development: human-readable coloured output.
      : {
          level: 'debug',
          transport: { target: 'pino-pretty', options: { colorize: true } },
        },
    bodyLimit: 2 * 1024 * 1024, // 2 MB; multipart routes set their own limit.
    // Return the request ID in error responses so clients can quote it in
    // support tickets and we can correlate to log entries.
    genReqId: () => crypto.randomUUID(),
  });

  // Security headers — CSP is disabled because this is a JSON API server,
  // not a page server. Helmet still sets HSTS, nosniff, X-Frame-Options, etc.
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  // CORS allow-list. FRONTEND_URLS (comma-separated) wins; FRONTEND_URL is
  // kept for backwards compatibility with single-origin deployments.
  const originList =
    parseOriginList(process.env.FRONTEND_URLS) ??
    parseOriginList(process.env.FRONTEND_URL) ??
    ['http://localhost:3000'];
  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin / curl / server-to-server
      if (originList.includes(origin)) return cb(null, true);
      cb(new Error('CORS: origin not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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
    // Return the requestId so clients can quote it in support tickets.
    reply
      .code(status)
      .header('X-Request-ID', request.id)
      .send({ ok: false, error: message, requestId: request.id });
  });

  // Health check — no auth, no rate limit, used by load balancers + UptimeRobot.
  await fastify.register(healthRoutes);

  // AI routes: auth on onRequest (so rate-limit can key by userId), and
  // rate-limit at preHandler (configured globally above) capped at 100/hr/user.
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
