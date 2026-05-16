import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { productBrainService, type EntryType } from '../services/productBrainService.js';

const requireUserId = (request: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = request.userId;
  if (!uid) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return null; }
  return uid;
};

const ENTRY_TYPES: EntryType[] = [
  'competitor_insight','market_signal','pm_insight','pricing_observation',
  'onboarding_pattern','feature_comparison','strategic_decision','ux_friction','icp_inference',
];

const createEntrySchema = z.object({
  entryType:   z.enum(ENTRY_TYPES as [EntryType, ...EntryType[]]),
  title:       z.string().min(1).max(300),
  content:     z.string().min(1).max(50_000),
  metadata:    z.record(z.string(), z.unknown()).optional(),
  sourceUrl:   z.string().url().optional(),
  confidence:  z.number().min(0).max(1).optional(),
  tags:        z.array(z.string()).max(20).optional(),
  workspaceId: z.string().nullish(),
}).strict();

const searchSchema = z.object({
  q:           z.string().min(2).max(1000),
  entryType:   z.enum(ENTRY_TYPES as [EntryType, ...EntryType[]]).optional(),
  workspaceId: z.string().optional(),
  limit:       z.coerce.number().int().min(1).max(50).default(10),
});

export default async function productBrainRoutes(fastify: FastifyInstance) {

  // GET /product-brain/entries — list entries with optional type filter.
  fastify.get('/entries', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const params = request.query as { entryType?: string; workspaceId?: string; limit?: string; offset?: string };
    const limit  = Math.min(parseInt(params.limit  ?? '50', 10), 100);
    const offset = parseInt(params.offset ?? '0', 10);

    const where: Record<string, unknown> = { userId };
    if (params.entryType)   where.entryType   = params.entryType;
    if (params.workspaceId) where.workspaceId = params.workspaceId;

    const [entries, total] = await Promise.all([
      db.productBrainEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.productBrainEntry.count({ where }),
    ]);

    reply.code(200).send({
      ok: true,
      data: {
        entries: entries.map((e) => ({
          ...e,
          metadata: e.metadata ? JSON.parse(e.metadata) : null,
          tags:     e.tags     ? JSON.parse(e.tags)     : [],
        })),
        total,
        limit,
        offset,
      },
    });
  });

  // GET /product-brain/entries/:id
  fastify.get<{ Params: { id: string } }>('/entries/:id', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const entry = await db.productBrainEntry.findUnique({ where: { id: request.params.id } });
    if (!entry || entry.userId !== userId) {
      reply.code(404).send({ ok: false, error: 'Not found' });
      return;
    }

    reply.code(200).send({
      ok: true,
      data: {
        ...entry,
        metadata: entry.metadata ? JSON.parse(entry.metadata) : null,
        tags:     entry.tags     ? JSON.parse(entry.tags)     : [],
      },
    });
  });

  // POST /product-brain/entries — manually create an entry.
  fastify.post('/entries', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const body = createEntrySchema.safeParse(request.body);
    if (!body.success) {
      reply.code(400).send({ ok: false, error: 'Invalid payload' });
      return;
    }

    const entryId = await productBrainService.create({ userId, ...body.data });
    reply.code(201).send({ ok: true, data: { entryId } });
  });

  // DELETE /product-brain/entries/:id
  fastify.delete<{ Params: { id: string } }>('/entries/:id', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const entry = await db.productBrainEntry.findUnique({ where: { id: request.params.id } });
    if (!entry || entry.userId !== userId) {
      reply.code(404).send({ ok: false, error: 'Not found' });
      return;
    }

    await db.productBrainEntry.delete({ where: { id: request.params.id } });
    reply.code(200).send({ ok: true });
  });

  // GET /product-brain/search — semantic similarity search.
  fastify.get('/search', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const params = searchSchema.safeParse(request.query);
    if (!params.success) {
      reply.code(400).send({ ok: false, error: 'q parameter required (min 2 chars)' });
      return;
    }
    const { q, entryType, workspaceId, limit } = params.data;

    const results = await productBrainService.search(userId, q, { limit, entryType, workspaceId });
    reply.code(200).send({ ok: true, data: results });
  });

  // GET /product-brain/competitors — competitor insights list.
  fastify.get('/competitors', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const params = request.query as { domain?: string; insightType?: string; limit?: string };
    const limit = Math.min(parseInt(params.limit ?? '50', 10), 100);

    const where: Record<string, unknown> = { userId };
    if (params.domain)      where.domain      = params.domain;
    if (params.insightType) where.insightType = params.insightType;

    const [insights, domains] = await Promise.all([
      db.competitorInsight.findMany({ where, orderBy: { capturedAt: 'desc' }, take: limit }),
      // Distinct domains for filter UI.
      db.competitorInsight.groupBy({ by: ['domain'], where: { userId }, _count: { _all: true } }),
    ]);

    reply.code(200).send({
      ok: true,
      data: {
        insights: insights.map((i) => ({ ...i, evidence: i.evidence ? JSON.parse(i.evidence) : [] })),
        domains: domains.map((d) => ({ domain: d.domain, count: d._count._all })),
      },
    });
  });

  // GET /product-brain/signals — market signal list.
  fastify.get('/signals', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const params = request.query as { signalType?: string; limit?: string };
    const limit = Math.min(parseInt(params.limit ?? '50', 10), 100);

    const where: Record<string, unknown> = { userId };
    if (params.signalType) where.signalType = params.signalType;

    const signals = await db.marketSignal.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      take: limit,
    });

    reply.code(200).send({
      ok: true,
      data: signals.map((s) => ({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })),
    });
  });
}
