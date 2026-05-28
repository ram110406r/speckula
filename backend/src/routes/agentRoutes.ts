// Agent routes — persistent agent identities + config, with live job stats.
//
// Agents are now first-class entities (model Agent). Job throughput stats are
// still derived from AnalysisJob.pageType at query time and joined onto each
// agent via its stable `key`. The four operational defaults are seeded per
// user on first access; users can also create custom agents.
//
// All endpoints are user-scoped (returns/mutates data for the caller only).

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';

const requireUserId = (request: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = request.userId;
  if (!uid) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return null; }
  return uid;
};

// Map a pageType string to a stable agent key for stat attribution.
const resolveAgentKey = (pageType: string | null): string => {
  const pt = (pageType ?? '').toLowerCase();
  if (/reddit|hn|twitter|social/.test(pt))    return 'market_scanner';
  if (/competitor|pricing|landing/.test(pt))   return 'competitor_watcher';
  if (/pm_tool|product|general/.test(pt))       return 'insight_synthesizer';
  return 'analysis_engine';
};

// The operational defaults seeded for every user. Keys must stay in sync with
// resolveAgentKey above so job stats attach correctly.
const DEFAULT_AGENTS: ReadonlyArray<{
  key: string; name: string; role: string; objective: string;
}> = [
  { key: 'market_scanner',      name: 'Market Scanner',      role: 'Market signal scanner',  objective: 'Scan social platforms and forums for emerging product signals.' },
  { key: 'competitor_watcher',  name: 'Competitor Watcher',  role: 'Competitor monitor',     objective: 'Track competitor pricing, landing pages, and feature changes.' },
  { key: 'insight_synthesizer', name: 'Insight Synthesizer', role: 'Insight synthesizer',    objective: 'Turn raw sources into structured, decision-ready product insights.' },
  { key: 'analysis_engine',     name: 'Analysis Engine',     role: 'General analysis pipeline', objective: 'Run general-purpose page analysis and classification.' },
];

const RUNNING_STATUSES = new Set([
  'extracting', 'classifying', 'generating_insights', 'embedding', 'saving',
]);

const AUTONOMY_LEVELS = ['manual', 'suggest', 'auto'] as const;
const MEMORY_SCOPES = ['none', 'agent', 'workspace', 'global'] as const;

const tryParse = <T = unknown>(raw: string | null | undefined): T | null => {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
};

// Idempotently ensure the four default agents exist for this user.
async function ensureDefaultAgents(userId: string): Promise<void> {
  await db.agent.createMany({
    data: DEFAULT_AGENTS.map((d) => ({
      userId,
      key:       d.key,
      name:      d.name,
      role:      d.role,
      objective: d.objective,
      isDefault: true,
    })),
    skipDuplicates: true,
  });
}

interface JobStats {
  runningJobs: number;
  queuedJobs: number;
  completedTotal: number;
  failedTotal: number;
  lastActivity: Date | null;
}

const emptyStats = (): JobStats => ({
  runningJobs: 0, queuedJobs: 0, completedTotal: 0, failedTotal: 0, lastActivity: null,
});

// Build per-key job stats from the user's AnalysisJob records.
async function computeJobStats(userId: string): Promise<Map<string, JobStats>> {
  const jobs = await db.analysisJob.findMany({
    where:  { userId },
    select: { status: true, pageType: true, createdAt: true, completedAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const byKey = new Map<string, JobStats>();
  for (const job of jobs) {
    const key = resolveAgentKey(job.pageType);
    if (!byKey.has(key)) byKey.set(key, emptyStats());
    const acc = byKey.get(key)!;

    if (job.status === 'queued')                acc.queuedJobs    += 1;
    else if (RUNNING_STATUSES.has(job.status))  acc.runningJobs   += 1;
    else if (job.status === 'completed')        acc.completedTotal += 1;
    else if (job.status === 'failed')           acc.failedTotal    += 1;

    const activity = job.completedAt ?? job.createdAt;
    if (!acc.lastActivity || activity > acc.lastActivity) acc.lastActivity = activity;
  }
  return byKey;
}

type AgentRow = Awaited<ReturnType<typeof db.agent.findMany>>[number];

function serializeAgent(agent: AgentRow, stats: JobStats) {
  const status = !agent.enabled
    ? 'disabled'
    : stats.runningJobs > 0
      ? 'running'
      : 'idle';
  return {
    id:            agent.id,
    key:           agent.key,
    name:          agent.name,
    role:          agent.role,
    objective:     agent.objective,
    modelName:     agent.modelName,
    temperature:   agent.temperature,
    autonomyLevel: agent.autonomyLevel,
    enabled:       agent.enabled,
    schedule:      agent.schedule,
    tokenBudget:   agent.tokenBudget,
    maxRetries:    agent.maxRetries,
    memoryScope:   agent.memoryScope,
    tools:             tryParse<string[]>(agent.tools),
    permissions:       tryParse(agent.permissions),
    confidenceProfile: tryParse(agent.confidenceProfile),
    executionPolicy:   tryParse(agent.executionPolicy),
    isDefault:     agent.isDefault,
    lastRunAt:     agent.lastRunAt,
    // Live stats
    status,
    runningJobs:    stats.runningJobs,
    queuedJobs:     stats.queuedJobs,
    completedTotal: stats.completedTotal,
    failedTotal:    stats.failedTotal,
    lastActivity:   stats.lastActivity,
  };
}

const CreateAgentSchema = z.object({
  name:        z.string().min(1).max(80),
  role:        z.string().min(1).max(120),
  objective:   z.string().max(600).nullish(),
  modelName:   z.string().max(80).optional(),
  temperature: z.number().min(0).max(2).optional(),
  autonomyLevel: z.enum(AUTONOMY_LEVELS).optional(),
  schedule:    z.string().max(120).nullish(),
  tokenBudget: z.number().int().min(0).nullish(),
  maxRetries:  z.number().int().min(0).max(5).optional(),
  memoryScope: z.enum(MEMORY_SCOPES).optional(),
  workspaceId: z.string().nullish(),
});

const UpdateAgentSchema = z.object({
  name:        z.string().min(1).max(80).optional(),
  role:        z.string().min(1).max(120).optional(),
  objective:   z.string().max(600).nullish(),
  modelName:   z.string().max(80).optional(),
  temperature: z.number().min(0).max(2).optional(),
  autonomyLevel: z.enum(AUTONOMY_LEVELS).optional(),
  enabled:     z.boolean().optional(),
  schedule:    z.string().max(120).nullish(),
  tokenBudget: z.number().int().min(0).nullish(),
  maxRetries:  z.number().int().min(0).max(5).optional(),
  memoryScope: z.enum(MEMORY_SCOPES).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'no fields to update' });

// Slugify a name into a candidate key; ensures uniqueness against existing keys.
function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'agent';
}

export default async function agentRoutes(fastify: FastifyInstance) {

  // GET /agents — agent roster (seeds defaults) with live job stats.
  fastify.get('/', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    await ensureDefaultAgents(userId);

    const [agents, statsByKey] = await Promise.all([
      db.agent.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
      computeJobStats(userId),
    ]);

    const agentList = agents.map((a) => serializeAgent(a, statsByKey.get(a.key) ?? emptyStats()));

    const summary = {
      total:     agentList.length,
      enabled:   agentList.filter((a) => a.enabled).length,
      running:   agentList.reduce((s, a) => s + a.runningJobs, 0),
      queued:    agentList.reduce((s, a) => s + a.queuedJobs, 0),
      completed: agentList.reduce((s, a) => s + a.completedTotal, 0),
      failed:    agentList.reduce((s, a) => s + a.failedTotal, 0),
    };

    reply.code(200).send({ ok: true, data: { agents: agentList, summary } });
  });

  // GET /agents/jobs — recent AnalysisJob records with optional status filter.
  // (Static route declared before /:id so it is not treated as an id.)
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
          id: true, status: true, progress: true, pageType: true,
          sourceUrl: true, createdAt: true, completedAt: true, error: true,
        },
      }),
      db.analysisJob.count({ where }),
    ]);

    reply.code(200).send({ ok: true, data: { jobs, total } });
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

  // POST /agents — create a custom agent.
  fastify.post('/', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const body = CreateAgentSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    // Derive a unique key from the name.
    const base = slugify(body.data.name);
    const existing = await db.agent.findMany({ where: { userId, key: { startsWith: base } }, select: { key: true } });
    const taken = new Set(existing.map((e) => e.key));
    let key = base;
    let n = 2;
    while (taken.has(key)) key = `${base}_${n++}`;

    const agent = await db.agent.create({
      data: {
        userId,
        workspaceId:   body.data.workspaceId ?? null,
        key,
        name:          body.data.name,
        role:          body.data.role,
        objective:     body.data.objective ?? null,
        modelName:     body.data.modelName,
        temperature:   body.data.temperature,
        autonomyLevel: body.data.autonomyLevel,
        schedule:      body.data.schedule ?? null,
        tokenBudget:   body.data.tokenBudget ?? null,
        maxRetries:    body.data.maxRetries,
        memoryScope:   body.data.memoryScope,
        isDefault:     false,
      },
    });

    reply.code(201).send({ ok: true, data: { agent: serializeAgent(agent, emptyStats()) } });
  });

  // GET /agents/:id — single agent with live stats.
  fastify.get('/:id', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    const { id } = request.params as { id: string };

    const agent = await db.agent.findFirst({ where: { id, userId } });
    if (!agent) return reply.code(404).send({ ok: false, error: 'agent not found' });

    const statsByKey = await computeJobStats(userId);
    reply.code(200).send({ ok: true, data: { agent: serializeAgent(agent, statsByKey.get(agent.key) ?? emptyStats()) } });
  });

  // PATCH /agents/:id — update agent config.
  fastify.patch('/:id', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    const { id } = request.params as { id: string };

    const body = UpdateAgentSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    const existing = await db.agent.findFirst({ where: { id, userId } });
    if (!existing) return reply.code(404).send({ ok: false, error: 'agent not found' });

    const d = body.data;
    const updated = await db.agent.update({
      where: { id },
      data: {
        ...(d.name        !== undefined ? { name: d.name } : {}),
        ...(d.role        !== undefined ? { role: d.role } : {}),
        ...(d.objective   !== undefined ? { objective: d.objective ?? null } : {}),
        ...(d.modelName   !== undefined ? { modelName: d.modelName } : {}),
        ...(d.temperature !== undefined ? { temperature: d.temperature } : {}),
        ...(d.autonomyLevel !== undefined ? { autonomyLevel: d.autonomyLevel } : {}),
        ...(d.enabled     !== undefined ? { enabled: d.enabled } : {}),
        ...(d.schedule    !== undefined ? { schedule: d.schedule ?? null } : {}),
        ...(d.tokenBudget !== undefined ? { tokenBudget: d.tokenBudget ?? null } : {}),
        ...(d.maxRetries  !== undefined ? { maxRetries: d.maxRetries } : {}),
        ...(d.memoryScope !== undefined ? { memoryScope: d.memoryScope } : {}),
      },
    });

    const statsByKey = await computeJobStats(userId);
    reply.code(200).send({ ok: true, data: { agent: serializeAgent(updated, statsByKey.get(updated.key) ?? emptyStats()) } });
  });

  // DELETE /agents/:id — delete a custom agent (defaults can only be disabled).
  fastify.delete('/:id', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    const { id } = request.params as { id: string };

    const existing = await db.agent.findFirst({ where: { id, userId } });
    if (!existing) return reply.code(404).send({ ok: false, error: 'agent not found' });
    if (existing.isDefault) {
      return reply.code(400).send({ ok: false, error: 'default agents cannot be deleted — disable instead' });
    }

    await db.agent.delete({ where: { id } });
    reply.code(200).send({ ok: true });
  });
}
