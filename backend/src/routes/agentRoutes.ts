// Agent status routes — maps AnalysisJob records to logical agent concepts.
// All endpoints are user-scoped (returns data for the authenticated user only).

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../lib/db.js';

const requireUserId = (request: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = request.userId;
  if (!uid) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return null; }
  return uid;
};

// Map a pageType string to a logical agent name.
const resolveAgentName = (pageType: string | null): string => {
  const pt = (pageType ?? '').toLowerCase();
  if (/reddit|hn|twitter|social/.test(pt))         return 'Market Scanner';
  if (/competitor|pricing|landing/.test(pt))        return 'Competitor Watcher';
  if (/pm_tool|product|general/.test(pt))           return 'Insight Synthesizer';
  return 'Analysis Engine';
};

const AGENT_NAMES = ['Market Scanner', 'Competitor Watcher', 'Insight Synthesizer', 'Analysis Engine'] as const;

type AgentName = (typeof AGENT_NAMES)[number];

interface AgentAccumulator {
  name:           AgentName;
  type:           AgentName;
  runningJobs:    number;
  queuedJobs:     number;
  completedTotal: number;
  failedTotal:    number;
  lastActivity:   Date | null;
}

export default async function agentRoutes(fastify: FastifyInstance) {

  // GET /agents — logical agent roster derived from AnalysisJob records.
  fastify.get('/', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const RUNNING_STATUSES = new Set([
      'extracting', 'classifying', 'generating_insights', 'embedding', 'saving',
    ]);

    const jobs = await db.analysisJob.findMany({
      where:  { userId },
      select: { status: true, pageType: true, createdAt: true, completedAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // Build per-agent accumulators.
    const agents = new Map<AgentName, AgentAccumulator>(
      AGENT_NAMES.map((name) => [name, {
        name,
        type:           name,
        runningJobs:    0,
        queuedJobs:     0,
        completedTotal: 0,
        failedTotal:    0,
        lastActivity:   null,
      }])
    );

    for (const job of jobs) {
      const name = resolveAgentName(job.pageType) as AgentName;
      const acc  = agents.get(name)!;

      if (job.status === 'queued')            acc.queuedJobs    += 1;
      else if (RUNNING_STATUSES.has(job.status)) acc.runningJobs += 1;
      else if (job.status === 'completed')    acc.completedTotal += 1;
      else if (job.status === 'failed')       acc.failedTotal    += 1;

      const activity = job.completedAt ?? job.createdAt;
      if (!acc.lastActivity || activity > acc.lastActivity) {
        acc.lastActivity = activity;
      }
    }

    const agentList = Array.from(agents.values()).map((a) => ({
      name:           a.name,
      type:           a.type,
      status:         a.runningJobs > 0 ? 'running' : ('idle' as 'running' | 'idle'),
      runningJobs:    a.runningJobs,
      queuedJobs:     a.queuedJobs,
      completedTotal: a.completedTotal,
      failedTotal:    a.failedTotal,
      lastActivity:   a.lastActivity,
    }));

    const summary = {
      running:   agentList.reduce((s, a) => s + a.runningJobs, 0),
      queued:    agentList.reduce((s, a) => s + a.queuedJobs, 0),
      completed: agentList.reduce((s, a) => s + a.completedTotal, 0),
      failed:    agentList.reduce((s, a) => s + a.failedTotal, 0),
    };

    reply.code(200).send({
      ok: true,
      data: { agents: agentList, summary },
    });
  });

  // GET /agents/jobs — recent AnalysisJob records with optional status filter.
  fastify.get('/jobs', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const query = request.query as { status?: string; limit?: string };

    const VALID_STATUSES = new Set([
      'queued', 'extracting', 'classifying', 'generating_insights',
      'embedding', 'saving', 'completed', 'failed',
    ]);

    const rawLimit = parseInt(query.limit ?? '20', 10);
    const limit    = Math.min(isNaN(rawLimit) ? 20 : rawLimit, 50);
    const status   = query.status && VALID_STATUSES.has(query.status) ? query.status : undefined;

    const where: { userId: string; status?: string } = { userId };
    if (status) where.status = status;

    const [jobs, total] = await Promise.all([
      db.analysisJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take:    limit,
        select: {
          id:          true,
          status:      true,
          progress:    true,
          pageType:    true,
          sourceUrl:   true,
          createdAt:   true,
          completedAt: true,
          error:       true,
        },
      }),
      db.analysisJob.count({ where }),
    ]);

    reply.code(200).send({
      ok: true,
      data: { jobs, total },
    });
  });

  // GET /agents/history — last 14 days of job activity as a daily trend.
  fastify.get('/history', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const jobs = await db.analysisJob.findMany({
      where:   { userId, createdAt: { gte: since14d } },
      select:  { status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day.
    const byDay = new Map<string, { queued: number; completed: number; failed: number }>();
    const byStatus: Record<string, number> = {};

    for (const job of jobs) {
      const day = job.createdAt.toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { queued: 0, completed: 0, failed: 0 });
      const entry = byDay.get(day)!;
      entry.queued += 1;
      if (job.status === 'completed') entry.completed += 1;
      if (job.status === 'failed')    entry.failed    += 1;

      byStatus[job.status] = (byStatus[job.status] ?? 0) + 1;
    }

    reply.code(200).send({
      ok: true,
      data: {
        dailyTrend: Array.from(byDay.entries()).map(([date, v]) => ({ date, ...v })),
        byStatus,
      },
    });
  });
}
