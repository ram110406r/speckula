import { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { getFirebaseApp } from '../lib/firebaseAdmin.js';

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/health',
    {
      config: { rateLimit: false },
    },
    async (_req, reply) => {
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
      reply.code(allOk ? 200 : 503).send({
        status: allOk ? 'ok' : 'degraded',
        checks,
        uptime: process.uptime(),
      });
    }
  );
}
