import { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { getFirebaseApp } from '../lib/firebaseAdmin.js';
import { getQueue, QUEUES } from '../lib/queue.js';

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/live',
    {
      config: { rateLimit: false },
    },
    async (_req, reply) => {
      reply.code(200).send({ status: 'ok' });
    }
  );

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

  // GET /health/metrics — operational metrics snapshot.
  // Protected by METRICS_TOKEN header (same pattern as /ws/connections).
  // No Firebase auth required — intended for internal monitoring tools.
  fastify.get(
    '/health/metrics',
    { config: { rateLimit: false } },
    async (request, reply) => {
      // Token guard: if METRICS_TOKEN is set, enforce it.
      const metricsToken = process.env.METRICS_TOKEN;
      if (metricsToken) {
        const provided = (request.headers['x-metrics-token'] as string | undefined) ?? '';
        if (provided !== metricsToken) {
          reply.code(403).send({ ok: false, error: 'Forbidden' });
          return;
        }
      }

      const runningStatuses = ['queued', 'extracting', 'classifying', 'generating_insights', 'embedding', 'saving'];
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Run all DB queries and queue stat fetch concurrently.
      const [
        queueCounts,
        productBrainEntries,
        competitorInsights,
        marketSignals,
        analysisJobs24h,
        analysisJobsRunning,
        notificationsUnread,
        wsConnections,
      ] = await Promise.all([
        getQueue(QUEUES.ANALYSIS).getJobCounts(),
        db.productBrainEntry.count(),
        db.competitorInsight.count(),
        db.marketSignal.count(),
        db.analysisJob.count({ where: { createdAt: { gte: since24h } } }),
        db.analysisJob.count({ where: { status: { in: runningStatuses } } }),
        db.notification.count({ where: { read: false } }),
        db.webSocketConnection.count(),
      ]);

      const mem = process.memoryUsage();

      reply.code(200).send({
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor(process.uptime()),
        queue: {
          analysis: {
            waiting:   queueCounts.waiting   ?? 0,
            active:    queueCounts.active    ?? 0,
            completed: queueCounts.completed ?? 0,
            failed:    queueCounts.failed    ?? 0,
            delayed:   queueCounts.delayed   ?? 0,
          },
        },
        database: {
          product_brain_entries:  productBrainEntries,
          competitor_insights:    competitorInsights,
          market_signals:         marketSignals,
          analysis_jobs_24h:      analysisJobs24h,
          analysis_jobs_running:  analysisJobsRunning,
          notifications_unread:   notificationsUnread,
        },
        websockets: {
          active_connections: wsConnections,
        },
        workers: {
          concurrency: parseInt(process.env.ANALYSIS_WORKER_CONCURRENCY ?? '5', 10),
          is_running:  process.env.EMBEDDED_WORKER === 'true' || process.env.WORKER_MODE === 'standalone',
        },
        process: {
          memory_rss_mb:       Math.round(mem.rss / 1024 / 1024),
          memory_heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
          node_version:        process.version,
        },
      });
    }
  );
}
