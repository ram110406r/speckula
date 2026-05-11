// Outcome routes — record expected vs actual metrics for decisions,
// then trigger the learning loop to generate a LearningInsight.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { generateLearningInsight } from '../services/learningService.js';
import { publishEvent } from '../services/eventBus.js';

const requireUserId = (req: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = req.userId;
  if (!uid) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return null; }
  return uid;
};

const CreateOutcomeSchema = z.object({
  decisionId:        z.string().min(1),
  decisionTitle:     z.string().min(1),
  expectedMetric:    z.string().min(1),
  expectedValue:     z.number(),
  expectedTimeframe: z.string().min(1),
  workspaceId:       z.string().optional(),
});

const RecordActualSchema = z.object({
  actualValue:  z.number(),
  observedAt:   z.string().datetime().optional(),
});

const computeVerdict = (expected: number, actual: number): { deviationPct: number; verdict: string } => {
  const deviationPct = expected !== 0 ? ((actual - expected) / Math.abs(expected)) * 100 : 0;
  let verdict: string;
  if (deviationPct >= 10)       verdict = 'exceeded';
  else if (deviationPct >= -5)  verdict = 'met';
  else if (deviationPct >= -25) verdict = 'missed';
  else                          verdict = 'far_off';
  return { deviationPct, verdict };
};

export default async function outcomeRoutes(fastify: FastifyInstance) {

  // POST /outcomes — record an expected outcome for a decision.
  fastify.post('/', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;

    const body = CreateOutcomeSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    const outcome = await db.outcome.create({
      data: {
        userId,
        workspaceId:       body.data.workspaceId ?? null,
        decisionId:        body.data.decisionId,
        decisionTitle:     body.data.decisionTitle,
        expectedMetric:    body.data.expectedMetric,
        expectedValue:     body.data.expectedValue,
        expectedTimeframe: body.data.expectedTimeframe,
        status:            'pending',
      },
    });

    reply.code(201).send({ ok: true, data: { outcome } });
  });

  // GET /outcomes — list outcomes for the user, optionally filtered by decisionId.
  fastify.get('/', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { decisionId, status } = req.query as { decisionId?: string; status?: string };

    const outcomes = await db.outcome.findMany({
      where: {
        userId,
        ...(decisionId ? { decisionId } : {}),
        ...(status     ? { status }     : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { learningInsights: { take: 1, orderBy: { createdAt: 'desc' } } },
    });

    reply.code(200).send({ ok: true, data: { outcomes } });
  });

  // GET /outcomes/:id — fetch a single outcome with its learning insights.
  fastify.get('/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const outcome = await db.outcome.findFirst({
      where:   { id, userId },
      include: { learningInsights: { orderBy: { createdAt: 'desc' } } },
    });

    if (!outcome) return reply.code(404).send({ ok: false, error: 'outcome not found' });
    reply.code(200).send({ ok: true, data: { outcome } });
  });

  // POST /outcomes/:id/actual — record the actual result and trigger learning.
  fastify.post('/:id/actual', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const body = RecordActualSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    const outcome = await db.outcome.findFirst({ where: { id, userId } });
    if (!outcome) return reply.code(404).send({ ok: false, error: 'outcome not found' });
    if (outcome.status === 'analyzed') {
      return reply.code(409).send({ ok: false, error: 'outcome already analyzed' });
    }

    const { deviationPct, verdict } = computeVerdict(outcome.expectedValue, body.data.actualValue);

    const updated = await db.outcome.update({
      where: { id },
      data:  {
        actualValue:  body.data.actualValue,
        observedAt:   body.data.observedAt ? new Date(body.data.observedAt) : new Date(),
        deviationPct,
        verdict,
        status:       'recorded',
      },
    });

    // Publish event so frontend knows outcome was recorded.
    await publishEvent({
      type:   'outcome.recorded',
      userId,
      data:   { outcomeId: id, decisionId: outcome.decisionId, verdict },
    }).catch(() => undefined);

    // Trigger learning insight generation (fire-and-forget — don't block the response).
    generateLearningInsight({
      outcomeId:      id,
      userId,
      decisionId:     outcome.decisionId,
      decisionTitle:  outcome.decisionTitle,
      expectedMetric: outcome.expectedMetric,
      expectedValue:  outcome.expectedValue,
      actualValue:    body.data.actualValue,
      deviationPct,
      verdict,
    }).catch((err) => {
      fastify.log.error({ err, outcomeId: id }, '[outcomes] learning insight generation failed');
    });

    reply.code(200).send({ ok: true, data: { outcome: updated } });
  });

  // DELETE /outcomes/:id — remove an outcome (only if not yet analyzed).
  fastify.delete('/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const outcome = await db.outcome.findFirst({ where: { id, userId } });
    if (!outcome) return reply.code(404).send({ ok: false, error: 'outcome not found' });

    await db.outcome.delete({ where: { id } });
    reply.code(200).send({ ok: true });
  });
}
