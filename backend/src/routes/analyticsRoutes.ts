// Analytics aggregation routes — product intelligence metrics for the dashboard.
// All endpoints are user-scoped (returns data for the authenticated user only).

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../lib/db.js';
import { wsManager } from '../services/websocketManager.js';

const requireUserId = (request: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = request.userId;
  if (!uid) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return null; }
  return uid;
};

export default async function analyticsRoutes(fastify: FastifyInstance) {

  // GET /analytics/overview — main dashboard stats card data.
  fastify.get('/overview', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const since7d  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000);
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalSignals,
      extensionSignals,
      weeklyCaptures,
      competitorInsights,
      marketSignals,
      productBrainTotal,
      jobsCompleted,
      jobsFailed,
      topDomains,
      extensionStatus,
      recentActivity,
    ] = await Promise.all([
      // Total Product Brain entries ever.
      db.productBrainEntry.count({ where: { userId } }),

      // Extension-sourced entries (have sourceJobId).
      db.productBrainEntry.count({ where: { userId, sourceJobId: { not: null } } }),

      // New entries this week.
      db.productBrainEntry.count({ where: { userId, createdAt: { gte: since7d } } }),

      // Competitor insights.
      db.competitorInsight.count({ where: { userId } }),

      // Market signals.
      db.marketSignal.count({ where: { userId } }),

      // Total Product Brain entries.
      db.productBrainEntry.count({ where: { userId } }),

      // AI jobs completed.
      db.analysisJob.count({ where: { userId, status: 'completed' } }),

      // AI jobs failed.
      db.analysisJob.count({ where: { userId, status: 'failed' } }),

      // Top 5 most-analyzed competitor domains.
      db.competitorInsight.groupBy({
        by: ['domain'],
        where: { userId, capturedAt: { gte: since30d } },
        _count: { _all: true },
        orderBy: { _count: { domain: 'desc' } },
        take: 5,
      }),

      // Extension last seen.
      db.extensionSession.findFirst({
        where: { userId },
        orderBy: { lastSeenAt: 'desc' },
        select: { lastSeenAt: true, extensionVersion: true, browserType: true },
      }),

      // Recent activity log (last 10 actions).
      db.activityLog.findMany({
        where: { userId, createdAt: { gte: since7d } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { action: true, resourceType: true, createdAt: true },
      }),
    ]);

    // Compute extension connection status.
    const msSinceHeartbeat = extensionStatus
      ? Date.now() - extensionStatus.lastSeenAt.getTime()
      : null;
    const extensionConnected =
      msSinceHeartbeat !== null && msSinceHeartbeat < 90_000;

    reply.code(200).send({
      ok: true,
      data: {
        totalSignals,
        extensionSignals,
        weeklyCaptures,
        competitorInsights,
        marketSignals,
        productBrainTotal,
        aiJobsCompleted: jobsCompleted,
        aiJobsFailed:    jobsFailed,
        topDomains: topDomains.map((d) => ({ domain: d.domain, count: d._count._all })),
        extension: {
          connected:        extensionConnected,
          lastSeenAt:       extensionStatus?.lastSeenAt?.toISOString() ?? null,
          extensionVersion: extensionStatus?.extensionVersion ?? null,
          browserType:      extensionStatus?.browserType ?? null,
        },
        realtimeConnections: wsManager.activeCount(),
        recentActivity: recentActivity.map((a) => ({
          action:       a.action,
          resourceType: a.resourceType,
          at:           a.createdAt.toISOString(),
        })),
      },
    });
  });

  // GET /analytics/jobs — job throughput trend (last 14 days).
  fastify.get('/jobs', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const jobs = await db.analysisJob.findMany({
      where: { userId, createdAt: { gte: since14d } },
      select: { status: true, createdAt: true, completedAt: true, pageType: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day.
    const byDay = new Map<string, { queued: number; completed: number; failed: number }>();
    for (const job of jobs) {
      const day = job.createdAt.toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { queued: 0, completed: 0, failed: 0 });
      const entry = byDay.get(day)!;
      entry.queued += 1;
      if (job.status === 'completed') entry.completed += 1;
      if (job.status === 'failed')    entry.failed    += 1;
    }

    // Page type breakdown.
    const byType = new Map<string, number>();
    for (const job of jobs) {
      const t = job.pageType ?? 'unknown';
      byType.set(t, (byType.get(t) ?? 0) + 1);
    }

    reply.code(200).send({
      ok: true,
      data: {
        dailyTrend: Array.from(byDay.entries()).map(([date, v]) => ({ date, ...v })),
        byPageType: Array.from(byType.entries()).map(([pageType, count]) => ({ pageType, count })),
        totalLast14Days: jobs.length,
      },
    });
  });

  // GET /analytics/product-brain — Product Brain entry trend.
  fastify.get('/product-brain', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [byType, recentEntries] = await Promise.all([
      db.productBrainEntry.groupBy({
        by: ['entryType'],
        where: { userId },
        _count: { _all: true },
        orderBy: { _count: { entryType: 'desc' } },
      }),
      db.productBrainEntry.findMany({
        where: { userId, createdAt: { gte: since30d } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, entryType: true, title: true, confidence: true, createdAt: true, sourceUrl: true },
      }),
    ]);

    reply.code(200).send({
      ok: true,
      data: {
        byType: byType.map((t) => ({ entryType: t.entryType, count: t._count._all })),
        recentEntries,
      },
    });
  });

  // GET /analytics/dashboard — comprehensive dashboard snapshot.
  // All queries run concurrently via Promise.all for a single round-trip cost.
  fastify.get('/dashboard', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const since7d   = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000);
    const since30d  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const runningStatuses = ['queued', 'extracting', 'classifying', 'generating_insights', 'embedding', 'saving'];

    const [
      totalSignals,
      weeklyCaptures,
      competitorInsights,
      marketSignals,
      aiJobsCompleted,
      aiJobsFailed,
      aiJobsRunning,
      productBrainTotal,
      extensionStatus,
      topDomains,
      recentActivity,
      unreadNotifications,
      brainByTypeRaw,
      signalsByTypeRaw,
      realtimeConnections,
    ] = await Promise.all([
      // Metrics cards
      db.productBrainEntry.count({ where: { userId } }),
      db.extensionHeartbeat.count({ where: { userId, createdAt: { gte: since7d } } }),
      db.competitorInsight.count({ where: { userId } }),
      db.marketSignal.count({ where: { userId } }),
      db.analysisJob.count({ where: { userId, status: 'completed' } }),
      db.analysisJob.count({ where: { userId, status: 'failed' } }),
      db.analysisJob.count({ where: { userId, status: { in: runningStatuses } } }),
      db.productBrainEntry.count({ where: { userId } }),

      // Extension connection status — most recent session row.
      db.extensionSession.findFirst({
        where: { userId },
        orderBy: { lastSeenAt: 'desc' },
        select: { lastSeenAt: true, extensionVersion: true, browserType: true },
      }),

      // Top 5 competitor domains (last 30 days).
      db.competitorInsight.groupBy({
        by: ['domain'],
        where: { userId, capturedAt: { gte: since30d } },
        _count: { _all: true },
        orderBy: { _count: { domain: 'desc' } },
        take: 5,
      }),

      // Recent activity (last 10 entries).
      db.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { action: true, resourceType: true, createdAt: true },
      }),

      // Unread notifications.
      db.notification.count({ where: { userId, read: false } }),

      // Product Brain entries grouped by type.
      db.productBrainEntry.groupBy({
        by: ['entryType'],
        where: { userId },
        _count: { _all: true },
      }),

      // Market signals grouped by type.
      db.marketSignal.groupBy({
        by: ['signalType'],
        where: { userId },
        _count: { _all: true },
      }),

      // Active WebSocket connections (global, not user-scoped).
      db.webSocketConnection.count(),
    ]);

    // Determine extension connected state from lastSeenAt vs 90-second window.
    const msSinceHeartbeat = extensionStatus
      ? Date.now() - extensionStatus.lastSeenAt.getTime()
      : null;
    const extensionConnected = msSinceHeartbeat !== null && msSinceHeartbeat < 90_000;

    // Convert groupBy results to plain Record<string, number>.
    const brainByType: Record<string, number> = {};
    for (const row of brainByTypeRaw) {
      brainByType[row.entryType] = row._count._all;
    }

    const signalsByType: Record<string, number> = {};
    for (const row of signalsByTypeRaw) {
      signalsByType[row.signalType] = row._count._all;
    }

    reply.code(200).send({
      ok: true,
      data: {
        totalSignals,
        weeklyCaptures,
        competitorInsights,
        marketSignals,
        aiJobsCompleted,
        aiJobsFailed,
        aiJobsRunning,
        productBrainTotal,
        extension: {
          connected:        extensionConnected,
          lastSeenAt:       extensionStatus?.lastSeenAt?.toISOString() ?? null,
          extensionVersion: extensionStatus?.extensionVersion ?? null,
          browserType:      extensionStatus?.browserType ?? null,
        },
        topDomains: topDomains.map((d) => ({ domain: d.domain, count: d._count._all })),
        recentActivity: recentActivity.map((a) => ({
          action:       a.action,
          resourceType: a.resourceType,
          at:           a.createdAt.toISOString(),
        })),
        unreadNotifications,
        brainByType,
        signalsByType,
        realtimeConnections,
      },
    });
  });
}
