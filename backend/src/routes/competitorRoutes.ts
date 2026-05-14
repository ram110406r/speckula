// Competitor intelligence routes — grouped insights, recent changes, monitored domains.
// All endpoints are user-scoped and optionally workspace-scoped.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../lib/db.js';
import { normalizeDomain } from '../lib/normalizeDomain.js';
import { publishEvent } from '../services/eventBus.js';

const requireUserId = (request: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = request.userId;
  if (!uid) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return null; }
  return uid;
};

const VALID_INSIGHT_TYPES = new Set([
  'pricing', 'positioning', 'onboarding', 'ux',
  'gtm', 'monetization', 'features', 'icp',
]);

export default async function competitorRoutes(fastify: FastifyInstance) {

  // POST /competitors — register a domain for explicit monitoring.
  // Validates the URL, normalises the domain, and creates a CompetitorMonitor entry.
  // The actual analysis happens when the user visits the page via the browser extension.
  fastify.post('/', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const body = request.body as { url?: unknown };
    const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';

    if (!rawUrl) {
      return reply.code(400).send({ ok: false, error: 'url is required' });
    }
    if (rawUrl.length > 2048) {
      return reply.code(400).send({ ok: false, error: 'url too long' });
    }

    // Validate URL — must parse as http or https.
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    } catch {
      return reply.code(400).send({ ok: false, error: 'Invalid URL format' });
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return reply.code(400).send({ ok: false, error: 'Only http/https URLs are allowed' });
    }

    const domain = normalizeDomain(rawUrl);
    if (!domain || domain.length < 3 || !domain.includes('.')) {
      return reply.code(400).send({ ok: false, error: 'Could not extract a valid domain' });
    }

    const params = request.query as { workspaceId?: string };
    const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId : null;

    // Deduplicate — return existing monitor if already tracking.
    const existing = await db.competitorMonitor.findUnique({
      where: { userId_domain: { userId, domain } },
    });
    if (existing) {
      return reply.code(200).send({
        ok: true,
        data: { domain, monitorId: existing.id, status: existing.status, alreadyTracking: true },
      });
    }

    const monitor = await db.competitorMonitor.create({
      data: { userId, workspaceId, domain, addedUrl: rawUrl, status: 'queued' },
    });

    publishEvent({
      type: 'competitor.added',
      userId,
      data: { domain },
    }).catch(() => undefined);

    return reply.code(201).send({
      ok: true,
      data: { domain, monitorId: monitor.id, status: 'queued', alreadyTracking: false },
    });
  });

  // GET /competitors — competitors grouped by domain, merged with monitor status.
  // Returns both fully-analysed competitors and queued/pending domains.
  fastify.get('/', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const params          = request.query as { workspaceId?: string };
    const workspaceFilter = params.workspaceId ? { workspaceId: params.workspaceId } : {};

    const [all, monitors] = await Promise.all([
      db.competitorInsight.findMany({
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
      }),
      db.competitorMonitor.findMany({
        where:   { userId, ...workspaceFilter },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const monitorMap = new Map(monitors.map((m) => [m.domain, m]));

    // Group insights by domain (insights are ordered desc so first = latest).
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
      const existing = grouped.get(insight.domain);
      if (!existing) {
        grouped.set(insight.domain, {
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
        // Keep non-null competitorName if we have one
        if (!existing.competitorName && insight.competitorName) {
          existing.competitorName = insight.competitorName;
        }
      }
    }

    // Build merged result — insights take priority; monitors fill in queued/failed entries.
    type CompetitorEntry = {
      domain:         string;
      competitorName: string | null;
      insightTypes:   string[];
      latestInsight:  InsightRow | null;
      totalInsights:  number;
      lastCapturedAt: Date | null;
      status:         string;
    };
    const result = new Map<string, CompetitorEntry>();

    for (const [domain, g] of grouped.entries()) {
      result.set(domain, {
        domain:         g.domain,
        competitorName: g.competitorName,
        insightTypes:   Array.from(g.insightTypes),
        latestInsight:  g.latestInsight,
        totalInsights:  g.totalInsights,
        lastCapturedAt: g.lastCapturedAt,
        status:         monitorMap.get(domain)?.status ?? 'completed',
      });
    }

    // Append monitored domains that have no insights yet (queued/failed).
    for (const monitor of monitors) {
      if (!result.has(monitor.domain)) {
        result.set(monitor.domain, {
          domain:         monitor.domain,
          competitorName: null,
          insightTypes:   [],
          latestInsight:  null,
          totalInsights:  0,
          lastCapturedAt: null,
          status:         monitor.status,
        });
      }
    }

    reply.code(200).send({ ok: true, data: { competitors: Array.from(result.values()) } });
  });

  // GET /competitors/changes — recent competitor insights with optional type filter.
  fastify.get('/changes', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const query = request.query as { type?: string; limit?: string; workspaceId?: string };

    const rawLimit        = parseInt(query.limit ?? '20', 10);
    const limit           = Math.min(isNaN(rawLimit) ? 20 : rawLimit, 50);
    const type            = query.type && VALID_INSIGHT_TYPES.has(query.type) ? query.type : undefined;
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

    reply.code(200).send({ ok: true, data: { changes, total } });
  });

  // GET /competitors/domains — unique monitored domains with insight counts.
  fastify.get('/domains', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const params          = request.query as { workspaceId?: string };
    const workspaceFilter = params.workspaceId ? { workspaceId: params.workspaceId } : {};

    const grouped = await db.competitorInsight.groupBy({
      by:      ['domain'],
      where:   { userId, ...workspaceFilter },
      _count:  { _all: true },
      _max:    { capturedAt: true },
      orderBy: { _count: { domain: 'desc' } },
    });

    const domains = grouped.map((row) => ({
      domain:   row.domain,
      count:    row._count._all,
      lastSeen: row._max?.capturedAt ?? null,
    }));

    reply.code(200).send({ ok: true, data: { domains } });
  });
}
