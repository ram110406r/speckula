// Experiment routes — manage A/B tests and compute statistical significance server-side.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { analyseExperiment, experimentVerdict } from '../services/statisticsService.js';
import { groqService } from '../services/groqService.js';
import { publishEvent } from '../services/eventBus.js';
import { getWorkspaceEvidence } from '../services/aiGroundingService.js';

const requireUserId = (req: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = req.userId;
  if (!uid) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return null; }
  return uid;
};

const CreateExperimentSchema = z.object({
  title:        z.string().min(1).max(200),
  hypothesis:   z.string().min(1).max(1000),
  targetMetric: z.string().min(1).max(100),
  workspaceId:  z.string().optional(),
  tags:         z.array(z.string()).optional(),
  variants:     z.array(z.object({
    name:      z.string().min(1),
    isControl: z.boolean().default(false),
  })).min(2),
});

const UpdateVariantSchema = z.object({
  impressions: z.number().int().min(0),
  conversions: z.number().int().min(0),
});

const AI_INSIGHT_PROMPT = (
  title: string, hypothesis: string, metric: string,
  stats: ReturnType<typeof analyseExperiment>,
  verdict: string,
  workspaceEvidence: string
) => `
You are SPECKULA's Experiment Analyst. An A/B test has concluded.

Experiment: "${title}"
Hypothesis: "${hypothesis}"
Target metric: ${metric}
Verdict: ${verdict.toUpperCase().replace('_', ' ')}

Variants:
${stats.map((s) =>
  `- ${s.name}: ${s.impressions} impressions, ${s.conversions} conversions ` +
  `(${(s.conversionRate * 100).toFixed(2)}%)${s.lift !== null ? `, lift ${s.lift.toFixed(1)}%` : ''}${s.significant ? ' ✓ significant' : ''}`
).join('\n')}

${workspaceEvidence ? `${workspaceEvidence}\n` : ''}

Write a 2-3 sentence PM insight explaining what happened and what to do next.
Ground recommendations in the variant stats. If workspace evidence is provided, reference it only when relevant; do not invent competitors/signals not present in the evidence.
Respond with plain text only — no JSON, no markdown.
`.trim();

export default async function experimentRoutes(fastify: FastifyInstance) {

  // GET /experiments — list experiments.
  fastify.get('/', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { status } = req.query as { status?: string };

    const experiments = await db.experiment.findMany({
      where:   { userId, deletedAt: null, ...(status ? { status } : {}) },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });

    // Attach live stats to each experiment.
    const enriched = experiments.map((exp) => ({
      ...exp,
      stats:   analyseExperiment(exp.variants),
      verdict: experimentVerdict(analyseExperiment(exp.variants)),
    }));

    reply.code(200).send({ ok: true, data: { experiments: enriched } });
  });

  // GET /experiments/:id — fetch a single experiment with full stats.
  fastify.get('/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const experiment = await db.experiment.findFirst({
      where:   { id, userId, deletedAt: null },
      include: { variants: true },
    });

    if (!experiment) return reply.code(404).send({ ok: false, error: 'experiment not found' });

    const stats   = analyseExperiment(experiment.variants);
    const verdict = experimentVerdict(stats);

    reply.code(200).send({ ok: true, data: { experiment: { ...experiment, stats, verdict } } });
  });

  // POST /experiments — create experiment with variants.
  fastify.post('/', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;

    const body = CreateExperimentSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    const hasControl = body.data.variants.some((v) => v.isControl);
    if (!hasControl) return reply.code(400).send({ ok: false, error: 'at least one variant must be the control' });

    const experiment = await db.experiment.create({
      data: {
        userId,
        workspaceId:  body.data.workspaceId ?? null,
        title:        body.data.title,
        hypothesis:   body.data.hypothesis,
        targetMetric: body.data.targetMetric,
        tags:         body.data.tags ? JSON.stringify(body.data.tags) : null,
        variants: {
          create: body.data.variants.map((v) => ({
            name:      v.name,
            isControl: v.isControl,
          })),
        },
      },
      include: { variants: true },
    });

    reply.code(201).send({ ok: true, data: { experiment } });
  });

  // PATCH /experiments/:id/status — start, pause, or complete an experiment.
  fastify.patch('/:id/status', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const schema = z.object({ status: z.enum(['running', 'paused', 'completed', 'abandoned']) });
    const body   = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    const experiment = await db.experiment.findFirst({ where: { id, userId, deletedAt: null } });
    if (!experiment) return reply.code(404).send({ ok: false, error: 'experiment not found' });

    const data: Record<string, unknown> = { status: body.data.status };
    if (body.data.status === 'running' && !experiment.startedAt) data.startedAt = new Date();
    if (body.data.status === 'completed' || body.data.status === 'abandoned')  data.endedAt = new Date();

    const updated = await db.experiment.update({ where: { id }, data });

    if (body.data.status === 'completed') {
      // Generate AI insight on completion (fire-and-forget).
      db.experiment.findFirst({ where: { id }, include: { variants: true } }).then(async (exp: { id: string; title: string; hypothesis: string; targetMetric: string; workspaceId: string | null; variants: { id: string; name: string; isControl: boolean; impressions: number; conversions: number }[] } | null) => {
        if (!exp) return;
        const stats   = analyseExperiment(exp.variants);
        const verdict = experimentVerdict(stats);

        try {
          const workspaceEvidence = await getWorkspaceEvidence({ userId, workspaceId: exp.workspaceId });
          const prompt = AI_INSIGHT_PROMPT(exp.title, exp.hypothesis, exp.targetMetric, stats, verdict, workspaceEvidence);
          const response = await groqService.callGroq(
            prompt,
            { model: 'reasoning', temperature: 0.3, maxTokens: 200 },
            userId,
            exp.workspaceId ?? 'experiments'
          );
          const aiInsight = response.content.trim();
          await db.experiment.update({ where: { id }, data: { aiInsight } });
        } catch {
          // Non-critical — experiment is still usable without AI insight.
        }

        await publishEvent({
          type:   'experiment.completed',
          userId,
          data:   { experimentId: id, verdict },
        }).catch(() => undefined);
      }).catch(() => undefined);
    }

    if (body.data.status === 'running') {
      await publishEvent({ type: 'experiment.started', userId, data: { experimentId: id, title: experiment.title } }).catch(() => undefined);
    }

    reply.code(200).send({ ok: true, data: { experiment: updated } });
  });

  // PUT /experiments/:id/variants/:variantId — update impressions/conversions.
  fastify.put('/:id/variants/:variantId', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id, variantId } = req.params as { id: string; variantId: string };

    const experiment = await db.experiment.findFirst({ where: { id, userId, deletedAt: null } });
    if (!experiment) return reply.code(404).send({ ok: false, error: 'experiment not found' });

    const body = UpdateVariantSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    if (body.data.conversions > body.data.impressions) {
      return reply.code(400).send({ ok: false, error: 'conversions cannot exceed impressions' });
    }

    const rate = body.data.impressions > 0 ? body.data.conversions / body.data.impressions : 0;

    const variant = await db.experimentVariant.update({
      where: { id: variantId },
      data:  { impressions: body.data.impressions, conversions: body.data.conversions, conversionRate: rate },
    });

    // Re-compute stats for all variants in this experiment.
    const allVariants = await db.experimentVariant.findMany({ where: { experimentId: id } });
    const stats       = analyseExperiment(allVariants);

    // Persist computed stats back.
    await Promise.all(
      stats.map((s) =>
        db.experimentVariant.update({
          where: { id: s.id },
          data:  { lift: s.lift, pValue: s.pValue, significant: s.significant, conversionRate: s.conversionRate },
        })
      )
    );

    reply.code(200).send({ ok: true, data: { variant, stats } });
  });

  // DELETE /experiments/:id — soft-delete.
  fastify.delete('/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const experiment = await db.experiment.findFirst({ where: { id, userId, deletedAt: null } });
    if (!experiment) return reply.code(404).send({ ok: false, error: 'experiment not found' });

    await db.experiment.update({ where: { id }, data: { deletedAt: new Date() } });
    reply.code(200).send({ ok: true });
  });
}
