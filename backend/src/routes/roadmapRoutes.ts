// Roadmap routes — CRUD for quarter-scoped roadmap items with AI scoring.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { groqService } from '../services/groqService.js';
import { publishEvent } from '../services/eventBus.js';
import { getWorkspaceEvidence } from '../services/aiGroundingService.js';

const requireUserId = (req: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = req.userId;
  if (!uid) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return null; }
  return uid;
};

const ItemSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  quarter:     z.string().regex(/^Q[1-4]\s\d{4}$/, 'Format must be "Q1 2026"'),
  priority:    z.enum(['high', 'medium', 'low']).default('medium'),
  decisionId:  z.string().nullish(),
  dependsOn:   z.array(z.string()).optional(),
  tags:        z.array(z.string()).optional(),
  workspaceId: z.string().nullish(),
});

const UpdateSchema = ItemSchema.partial();

const GenerateSchema = z.object({
  quarter:     z.string().regex(/^Q[1-4]\s\d{4}$/),
  context:     z.string().min(10).max(2000),
  workspaceId: z.string().nullish(),
});

const AI_ROADMAP_PROMPT = (quarter: string, context: string, workspaceEvidence: string) => `
You are SPECKULA's Roadmap AI. Generate a prioritized roadmap for ${quarter}.
Strategic context: ${context}

${workspaceEvidence ? `${workspaceEvidence}\n` : ''}

Respond ONLY with valid JSON:
{
  "items": [
    {
      "title": "string",
      "description": "string",
      "priority": "high|medium|low",
      "aiScore": 0.0-1.0,
      "aiRationale": "why this item and score",
      "tags": ["string"]
    }
  ]
}
Generate 4-6 items. Score reflects strategic alignment. High priority = score > 0.75.
`.trim();

export default async function roadmapRoutes(fastify: FastifyInstance) {

  // GET /roadmaps — list roadmap items, optionally filtered by quarter/status/workspaceId.
  fastify.get('/', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { quarter, status, workspaceId } = req.query as {
      quarter?: string; status?: string; workspaceId?: string;
    };

    const rawItems = await db.roadmapItem.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(quarter     ? { quarter }     : {}),
        ...(status      ? { status }      : {}),
        ...(workspaceId ? { workspaceId } : {}),
      },
      // Fetch without priority sort — we sort in-memory with semantic ordering below.
      orderBy: [{ quarter: 'asc' }, { createdAt: 'desc' }],
    });

    // Sort by semantic priority (high → medium → low), not alphabetical.
    const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const items = rawItems.sort((a, b) => {
      if (a.quarter !== b.quarter) return a.quarter.localeCompare(b.quarter);
      return (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
    });

    // Group by quarter for the frontend view.
    const byQuarter: Record<string, typeof items> = {};
    for (const item of items) {
      if (!byQuarter[item.quarter]) byQuarter[item.quarter] = [];
      byQuarter[item.quarter].push(item);
    }

    reply.code(200).send({ ok: true, data: { items, byQuarter } });
  });

  // POST /roadmaps — create a single roadmap item.
  fastify.post('/', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;

    const body = ItemSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    const item = await db.roadmapItem.create({
      data: {
        userId,
        workspaceId: body.data.workspaceId ?? null,
        title:       body.data.title,
        description: body.data.description ?? null,
        quarter:     body.data.quarter,
        priority:    body.data.priority,
        decisionId:  body.data.decisionId ?? null,
        dependsOn:   body.data.dependsOn ? JSON.stringify(body.data.dependsOn) : null,
        tags:        body.data.tags       ? JSON.stringify(body.data.tags)      : null,
      },
    });

    reply.code(201).send({ ok: true, data: { item } });
  });

  // POST /roadmaps/generate — AI-generate a full quarter roadmap.
  fastify.post('/generate', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;

    const body = GenerateSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    let generated: Array<{
      title: string; description: string; priority: string;
      aiScore: number; aiRationale: string; tags: string[];
    }> = [];

    try {
      const workspaceEvidence = await getWorkspaceEvidence({ userId, workspaceId: body.data.workspaceId ?? null });
      const prompt = AI_ROADMAP_PROMPT(body.data.quarter, body.data.context, workspaceEvidence);
      const response = await groqService.callGroq(
        prompt,
        { model: 'reasoning', jsonMode: true, temperature: 0.4, maxTokens: 1500 },
        userId,
        body.data.workspaceId ?? 'roadmaps'
      );
      const raw = JSON.parse(response.content ?? '{}') as { items?: typeof generated };
      generated = raw.items ?? [];
    } catch (err) {
      fastify.log.error({ err }, '[roadmaps] AI generation failed');
      return reply.code(500).send({ ok: false, error: 'AI roadmap generation failed' });
    }

    const items = await Promise.all(
      generated.map((g) =>
        db.roadmapItem.create({
          data: {
            userId,
            workspaceId: body.data.workspaceId ?? null,
            title:       g.title,
            description: g.description ?? null,
            quarter:     body.data.quarter,
            priority:    (['high', 'medium', 'low'].includes(g.priority) ? g.priority : 'medium') as 'high' | 'medium' | 'low',
            aiScore:     g.aiScore,
            aiRationale: g.aiRationale ?? null,
            tags:        g.tags ? JSON.stringify(g.tags) : null,
          },
        })
      )
    );

    await publishEvent({
      type:   'roadmap.generated',
      userId,
      data:   { itemCount: items.length, quarter: body.data.quarter },
    }).catch(() => undefined);

    reply.code(201).send({ ok: true, data: { items, quarter: body.data.quarter } });
  });

  // PATCH /roadmaps/:id — update a roadmap item.
  fastify.patch('/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const item = await db.roadmapItem.findFirst({ where: { id, userId, deletedAt: null } });
    if (!item) return reply.code(404).send({ ok: false, error: 'item not found' });

    const body = UpdateSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    const updated = await db.roadmapItem.update({
      where: { id },
      data:  {
        title:       body.data.title,
        description: body.data.description,
        quarter:     body.data.quarter,
        priority:    body.data.priority,
        decisionId:  body.data.decisionId,
        dependsOn:   body.data.dependsOn !== undefined ? JSON.stringify(body.data.dependsOn) : undefined,
        tags:        body.data.tags       !== undefined ? JSON.stringify(body.data.tags)      : undefined,
      },
    });

    reply.code(200).send({ ok: true, data: { item: updated } });
  });

  // PATCH /roadmaps/:id/status — quick status / progress update.
  fastify.patch('/:id/status', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const schema = z.object({
      status:   z.enum(['planned', 'in_progress', 'completed', 'dropped']).optional(),
      progress: z.number().min(0).max(100).optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    const item = await db.roadmapItem.findFirst({ where: { id, userId, deletedAt: null } });
    if (!item) return reply.code(404).send({ ok: false, error: 'item not found' });

    const updated = await db.roadmapItem.update({ where: { id }, data: body.data });
    reply.code(200).send({ ok: true, data: { item: updated } });
  });

  // DELETE /roadmaps/:id — soft-delete.
  fastify.delete('/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const item = await db.roadmapItem.findFirst({ where: { id, userId, deletedAt: null } });
    if (!item) return reply.code(404).send({ ok: false, error: 'item not found' });

    await db.roadmapItem.update({ where: { id }, data: { deletedAt: new Date() } });
    reply.code(200).send({ ok: true });
  });
}
