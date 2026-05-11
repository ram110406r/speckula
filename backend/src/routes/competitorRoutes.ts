// Competitor intelligence routes — grouped insights, recent changes, monitored domains.
// All endpoints are user-scoped and optionally workspace-scoped.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../lib/db.js';

const requireUserId = (request: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = request.userId;
  if (!uid) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return null; }
  return uid;
};

export default async function competitorRoutes(fastify: FastifyInstance) {

  // GET /competitors — list of competitors grouped by (domain + competitorName).
  fastify.get('/', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const params          = request.query as { workspaceId?: string };
    const workspaceFilter = params.workspaceId ? { workspaceId: params.workspaceId } : {};

    const all = await db.competitorInsight.findMany({
      where:   { userId, ...workspaceFilter },
      orderBy: { capturedAt: 'desc' },
      select: {
        id:             true,
        domain:         true,
        competitorName: true,
        insightType:    true,
        title:          true,
        content:        true,
        evidence:       true,
        sourceUrl:      true,
        confidence:     true,
        capturedAt:     true,
        createdAt:      true,
      },
    });

    // Group by domain + competitorName key.
    type InsightRow = (typeof all)[number];
    const grouped = new Map<string, {
      domain:         string;
      competitorName: string | null;
      insightTypes:   Set<string>;
      latestInsight:  InsightRow;
      totalInsights:  number;
      lastCapturedAt: Date;
    }>();

    for (const insight of all) {
      const key = `${insight.domain}::${insight.competitorName ?? ''}`;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          domain:         insight.domain,
          competitorName: insight.competitorName,
          insightTypes:   new Set([insight.insightType]),
          latestInsight:  insight,
          totalInsights:  1,
          lastCapturedAt: insight.capturedAt,
        });
      } else {
        existing.insightTypes.add(insight.insightType);
        existing.totalInsights += 1;
        // all rows ordered desc so the first entry is always the latest
      }
    }

    const competitors = Array.from(grouped.values()).map((g) => ({
      domain:         g.domain,
      competitorName: g.competitorName,
      insightTypes:   Array.from(g.insightTypes),
      latestInsight:  g.latestInsight,
      totalInsights:  g.totalInsights,
      lastCapturedAt: g.lastCapturedAt,
    }));

    reply.code(200).send({
      ok: true,
      data: { competitors },
    });
  });

  // GET /competitors/changes — recent competitor insights with optional type filter.
  fastify.get('/changes', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const query = request.query as { type?: string; limit?: string; workspaceId?: string };

    const VALID_TYPES = new Set([
      'pricing', 'positioning', 'onboarding', 'ux',
      'gtm', 'monetization', 'features', 'icp',
    ]);

    const rawLimit        = parseInt(query.limit ?? '20', 10);
    const limit           = Math.min(isNaN(rawLimit) ? 20 : rawLimit, 50);
    const type            = query.type && VALID_TYPES.has(query.type) ? query.type : undefined;
    const workspaceFilter = query.workspaceId ? { workspaceId: query.workspaceId } : {};

    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const where: {
      userId: string;
      workspaceId?: string;
      capturedAt: { gte: Date };
      insightType?: string;
    } = { userId, ...workspaceFilter, capturedAt: { gte: since30d } };
    if (type) where.insightType = type;

    const [changes, total] = await Promise.all([
      db.competitorInsight.findMany({
        where,
        orderBy: { capturedAt: 'desc' },
        take:    limit,
        select: {
          id:             true,
          domain:         true,
          competitorName: true,
          insightType:    true,
          title:          true,
          content:        true,
          evidence:       true,
          sourceUrl:      true,
          confidence:     true,
          capturedAt:     true,
          createdAt:      true,
        },
      }),
      db.competitorInsight.count({ where }),
    ]);

    reply.code(200).send({
      ok: true,
      data: { changes, total },
    });
  });

  // GET /competitors/domains — unique monitored domains with insight counts.
  fastify.get('/domains', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const params          = request.query as { workspaceId?: string };
    const workspaceFilter = params.workspaceId ? { workspaceId: params.workspaceId } : {};

    const grouped = await db.competitorInsight.groupBy({
      by:     ['domain'],
      where:  { userId, ...workspaceFilter },
      _count: { _all: true },
      _max:   { capturedAt: true },
      orderBy: { _count: { domain: 'desc' } },
    });

    const domains = grouped.map((row) => ({
      domain:   row.domain,
      count:    row._count._all,
      lastSeen: row._max?.capturedAt ?? null,
    }));

    reply.code(200).send({
      ok: true,
      data: { domains },
    });
  });
}
