// Agent run routes — track Autonomous Mode sessions server-side.
// The frontend orchestrates the multi-step reasoning; this backend persists
// each run's state, breadcrumb steps, and final outputs for history and analytics.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { publishEvent } from '../services/eventBus.js';

const requireUserId = (req: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = req.userId;
  if (!uid) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return null; }
  return uid;
};

const StartSchema = z.object({
  idea:        z.string().min(1).max(2000),
  depth:       z.enum(['quick', 'standard', 'deep']).default('standard'),
  workspaceId: z.string().optional(),
});

const StepSchema = z.object({
  step:    z.string().min(1),
  payload: z.unknown().optional(),
});

const CompleteSchema = z.object({
  clarifications: z.array(z.string()).optional(),
  decisions:      z.array(z.unknown()).optional(),
  strategy:       z.unknown().optional(),
  roadmap:        z.unknown().optional(),
  verdict:        z.enum(['PROCEED', 'VALIDATE_FIRST', 'DO_NOT_BUILD']),
  verdictReason:  z.string().optional(),
  modelUsed:      z.string().optional(),
  tokensUsed:     z.number().int().min(0).default(0),
});

export default async function agentRunRoutes(fastify: FastifyInstance) {

  // POST /agent-runs — start a new Autonomous Mode run.
  fastify.post('/', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;

    const body = StartSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    const run = await db.agentRun.create({
      data: {
        userId,
        workspaceId: body.data.workspaceId ?? null,
        idea:        body.data.idea,
        depth:       body.data.depth,
        status:      'running',
        currentStep: 'understand_idea',
        steps:       JSON.stringify([{ step: 'understand_idea', ts: new Date().toISOString() }]),
      },
    });

    await publishEvent({
      type:   'agent.started',
      userId,
      data:   { runId: run.id, depth: body.data.depth },
    }).catch(() => undefined);

    reply.code(201).send({ ok: true, data: { run } });
  });

  // GET /agent-runs — list recent runs for the user.
  fastify.get('/', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { status, limit } = req.query as { status?: string; limit?: string };

    const take    = Math.min(parseInt(limit ?? '20', 10) || 20, 50);
    const runs    = await db.agentRun.findMany({
      where:   { userId, ...(status ? { status } : {}) },
      orderBy: { startedAt: 'desc' },
      take,
      select: {
        id:          true,
        idea:        true,
        depth:       true,
        status:      true,
        currentStep: true,
        verdict:     true,
        verdictReason: true,
        tokensUsed:  true,
        durationMs:  true,
        startedAt:   true,
        completedAt: true,
        error:       true,
      },
    });

    reply.code(200).send({ ok: true, data: { runs } });
  });

  // GET /agent-runs/:id — fetch full run detail including steps and outputs.
  fastify.get('/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const run = await db.agentRun.findFirst({ where: { id, userId } });
    if (!run) return reply.code(404).send({ ok: false, error: 'run not found' });

    // Parse JSON fields for convenience.
    const enriched = {
      ...run,
      steps:          tryParse(run.steps),
      clarifications: tryParse(run.clarifications),
      decisions:      tryParse(run.decisions),
      strategy:       tryParse(run.strategy),
      roadmap:        tryParse(run.roadmap),
    };

    reply.code(200).send({ ok: true, data: { run: enriched } });
  });

  // POST /agent-runs/:id/step — append a step to the run breadcrumb.
  fastify.post('/:id/step', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const body = StepSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    const run = await db.agentRun.findFirst({ where: { id, userId } });
    if (!run) return reply.code(404).send({ ok: false, error: 'run not found' });
    if (run.status !== 'running') return reply.code(409).send({ ok: false, error: 'run is not active' });

    const existingSteps = tryParse<unknown[]>(run.steps) ?? [];
    const newStep = { step: body.data.step, ts: new Date().toISOString(), payload: body.data.payload ?? null };

    await db.agentRun.update({
      where: { id },
      data:  { currentStep: body.data.step, steps: JSON.stringify([...existingSteps, newStep]) },
    });

    await publishEvent({
      type:   'agent.step',
      userId,
      data:   { runId: id, step: body.data.step, payload: body.data.payload },
    }).catch(() => undefined);

    reply.code(200).send({ ok: true });
  });

  // POST /agent-runs/:id/complete — finalize a run with outputs and verdict.
  fastify.post('/:id/complete', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const body = CompleteSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    const run = await db.agentRun.findFirst({ where: { id, userId } });
    if (!run) return reply.code(404).send({ ok: false, error: 'run not found' });

    const durationMs = run.startedAt ? Date.now() - run.startedAt.getTime() : null;

    const updated = await db.agentRun.update({
      where: { id },
      data: {
        status:        'completed',
        currentStep:   'output',
        clarifications: body.data.clarifications ? JSON.stringify(body.data.clarifications) : null,
        decisions:     body.data.decisions  ? JSON.stringify(body.data.decisions)  : null,
        strategy:      body.data.strategy   ? JSON.stringify(body.data.strategy)   : null,
        roadmap:       body.data.roadmap    ? JSON.stringify(body.data.roadmap)    : null,
        verdict:       body.data.verdict,
        verdictReason: body.data.verdictReason ?? null,
        modelUsed:     body.data.modelUsed  ?? null,
        tokensUsed:    body.data.tokensUsed,
        durationMs,
        completedAt:   new Date(),
      },
    });

    await publishEvent({
      type:   'agent.completed',
      userId,
      data:   { runId: id, verdict: body.data.verdict, tokensUsed: body.data.tokensUsed },
    }).catch(() => undefined);

    reply.code(200).send({ ok: true, data: { run: updated } });
  });

  // POST /agent-runs/:id/stop — mark a run as stopped by the user.
  fastify.post('/:id/stop', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const run = await db.agentRun.findFirst({ where: { id, userId } });
    if (!run) return reply.code(404).send({ ok: false, error: 'run not found' });

    const durationMs = run.startedAt ? Date.now() - run.startedAt.getTime() : null;

    await db.agentRun.update({
      where: { id },
      data:  { status: 'stopped', durationMs, completedAt: new Date() },
    });

    await publishEvent({ type: 'agent.stopped', userId, data: { runId: id } }).catch(() => undefined);

    reply.code(200).send({ ok: true });
  });

  // GET /agent-runs/stats — aggregate stats for the Agents view.
  fastify.get('/stats', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;

    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, verdictCounts, recentRuns] = await Promise.all([
      db.agentRun.count({ where: { userId } }),
      db.agentRun.groupBy({
        by:     ['verdict'],
        where:  { userId, verdict: { not: null } },
        _count: { verdict: true },
      }),
      db.agentRun.findMany({
        where:  { userId, startedAt: { gte: since30d } },
        select: { durationMs: true, tokensUsed: true, verdict: true },
      }),
    ]);

    const verdictMap = Object.fromEntries(
      verdictCounts.map((v) => [v.verdict, v._count.verdict])
    );
    const withDuration = recentRuns.filter((r) => r.durationMs !== null);
    const avgDuration  = withDuration.length > 0
      ? withDuration.reduce((s, r) => s + (r.durationMs ?? 0), 0) / withDuration.length
      : 0;
    const totalTokens  = recentRuns.reduce((s, r) => s + r.tokensUsed, 0);

    reply.code(200).send({
      ok: true,
      data: {
        total,
        last30Days: recentRuns.length,
        verdicts:   verdictMap,
        avgDurationMs: Math.round(avgDuration),
        totalTokensLast30d: totalTokens,
      },
    });
  });
}

const tryParse = <T = unknown>(raw: string | null | undefined): T | null => {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
};
