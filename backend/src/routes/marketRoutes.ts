// Market signal routes — trend data, opportunity signals, and aggregations.
// All endpoints are user-scoped and optionally workspace-scoped.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../lib/db.js';

const requireUserId = (request: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = request.userId;
  if (!uid) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return null; }
  return uid;
};

export default async function marketRoutes(fastify: FastifyInstance) {

  // GET /market/signals — paginated list of market signals with optional type filter.
  fastify.get('/signals', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const query = request.query as {
      type?: string;
      limit?: string;
      cursor?: string;
      workspaceId?: string;
    };

    const VALID_TYPES = new Set([
      'trend', 'competitor_move', 'market_shift',
      'customer_feedback', 'pricing_change', 'feature_launch',
    ]);

    const rawLimit      = parseInt(query.limit ?? '20', 10);
    const limit         = Math.min(isNaN(rawLimit) ? 20 : rawLimit, 50);
    const type          = query.type && VALID_TYPES.has(query.type) ? query.type : undefined;
    const cursor        = query.cursor ? new Date(query.cursor) : undefined;
    const workspaceFilter = query.workspaceId ? { workspaceId: query.workspaceId } : {};

    const where: {
      userId: string;
      workspaceId?: string;
      signalType?: string;
      detectedAt?: { lt: Date };
    } = { userId, ...workspaceFilter };
    if (type)   where.signalType  = type;
    if (cursor) where.detectedAt  = { lt: cursor };

    const [signals, total] = await Promise.all([
      db.marketSignal.findMany({
        where,
        orderBy: { detectedAt: 'desc' },
        take: limit + 1, // fetch one extra to determine nextCursor
        select: {
          id:         true,
          signalType: true,
          title:      true,
          content:    true,
          sourceUrl:  true,
          strength:   true,
          tags:       true,
          detectedAt: true,
          createdAt:  true,
        },
      }),
      db.marketSignal.count({ where: { userId, ...workspaceFilter, ...(type ? { signalType: type } : {}) } }),
    ]);

    let nextCursor: string | null = null;
    const page = signals;
    if (signals.length > limit) {
      page.pop();
      nextCursor = page[page.length - 1]?.detectedAt?.toISOString() ?? null;
    }

    reply.code(200).send({
      ok: true,
      data: {
        signals:    page,
        nextCursor,
        total,
      },
    });
  });

  // GET /market/trends — aggregated signal counts over the last 30 days.
  fastify.get('/trends', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [byTypeRaw, recentHighStrength] = await Promise.all([
      db.marketSignal.groupBy({
        by:     ['signalType'],
        where:  { userId, detectedAt: { gte: since30d } },
        _count: { _all: true },
        _avg:   { strength: true },
        orderBy: { _count: { signalType: 'desc' } },
      }),
      db.marketSignal.findMany({
        where:   { userId, strength: { gt: 0.7 }, detectedAt: { gte: since30d } },
        orderBy: { detectedAt: 'desc' },
        take:    5,
        select: {
          id:         true,
          signalType: true,
          title:      true,
          content:    true,
          sourceUrl:  true,
          strength:   true,
          tags:       true,
          detectedAt: true,
          createdAt:  true,
        },
      }),
    ]);

    reply.code(200).send({
      ok: true,
      data: {
        byType: byTypeRaw.map((row) => ({
          type:        row.signalType,
          count:       row._count._all,
          avgStrength: row._avg?.strength ?? 0,
        })),
        recentHighStrength,
      },
    });
  });

  // GET /market/opportunities — high-confidence pm_insight / strategic_decision entries.
  fastify.get('/opportunities', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const params         = request.query as { workspaceId?: string };
    const workspaceFilter = params.workspaceId ? { workspaceId: params.workspaceId } : {};

    const opportunities = await db.productBrainEntry.findMany({
      where: {
        userId,
        ...workspaceFilter,
        entryType:  { in: ['pm_insight', 'strategic_decision'] },
        confidence: { gt: 0.7 },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id:         true,
        entryType:  true,
        title:      true,
        content:    true,
        confidence: true,
        sourceUrl:  true,
        tags:       true,
        createdAt:  true,
        updatedAt:  true,
      },
    });

    reply.code(200).send({
      ok: true,
      data: { opportunities },
    });
  });
}
