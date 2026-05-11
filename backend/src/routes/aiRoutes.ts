import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { groqService, getCircuitBreakerState } from '../services/groqService.js';
import { z } from 'zod';
import { utcDayStart } from '../lib/dateUtils.js';
import { classifyPrismaError } from '../lib/prismaErrors.js';

const MAX_CONTENT_CHARS = 80_000;

// v2.3: optional prompt-registry correlation. Forwarded to PromptLog so
// behavior shifts can be attributed to a specific prompt version.
const promptMetaSchema = z.object({
  promptId: z.string().min(1).max(64).optional(),
  promptVersion: z.string().min(1).max(32).optional(),
  promptHash: z.string().min(1).max(32).optional(),
}).strict();

const generateInsightsSchema = z.object({
  projectId: z.string().min(1).optional(),
  noteId: z.string().min(1),
  content: z.string().min(1).max(MAX_CONTENT_CHARS),
  _meta: promptMetaSchema.optional(),
}).strict();

const generatePRDSchema = z.object({
  projectId: z.string().min(1).optional(),
  title: z.string().min(1).max(200),
  notes: z.string().min(1).max(MAX_CONTENT_CHARS),
  decisions: z.string().max(MAX_CONTENT_CHARS).optional().default(""),
  _meta: promptMetaSchema.optional(),
}).strict();

const suggestTasksSchema = z.object({
  projectId: z.string().min(1).optional(),
  prdContent: z.string().min(1).max(MAX_CONTENT_CHARS),
  prdId: z.string().min(1).optional(),
}).strict();

const DEFAULT_PROJECT_ID = "default";

const analyzePatternsSchema = z.object({
  projectId: z.string().min(1),
  noteId: z.string().min(1),
  content: z.string().min(1).max(MAX_CONTENT_CHARS),
}).strict();

const scoreDecisionSchema = z.object({
  projectId: z.string().min(1),
  decisionId: z.string().min(1),
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(MAX_CONTENT_CHARS),
  context: z.string().max(MAX_CONTENT_CHARS),
}).strict();

const analyzeSignalsSchema = z.object({
  projectId: z.string().min(1).optional(),
  content: z.string().min(1).max(4_000),
}).strict();

const usageDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

const requireUserId = (request: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = request.userId;
  if (!uid) {
    reply.code(401).send({ ok: false, error: 'unauthorized' });
    return null;
  }
  return uid;
};

// Distinguish between "your input was bad" (4xx) and "something on our side
// broke" (5xx) so the frontend can react appropriately.
const classify = (error: unknown): { status: number; message: string } => {
  if (error instanceof z.ZodError) {
    return { status: 400, message: 'Invalid request payload' };
  }
  const prisma = classifyPrismaError(error);
  if (prisma) return prisma;
  const status = (error as { status?: number; statusCode?: number })?.status
    ?? (error as { status?: number; statusCode?: number })?.statusCode;
  if (typeof status === 'number') {
    if (status === 401) return { status: 503, message: 'AI service authentication failed — verify GROQ_API_KEY.' };
    if (status === 429) return { status: 429, message: 'Upstream rate limit reached. Try again shortly.' };
    if (status >= 400) return { status: 502, message: 'Upstream AI service error' };
  }
  return { status: 500, message: 'Internal error' };
};

const replyError = (
  reply: FastifyReply,
  error: unknown,
  fallback: string
) => {
  const { status, message } = classify(error);
  const detail = error instanceof Error ? error.message : null;
  const isProd = process.env.NODE_ENV === 'production';
  reply.code(status).send({
    ok: false,
    error: status >= 500 && isProd ? message : (detail || fallback),
  });
};

export default async function aiRoutes(fastify: FastifyInstance) {
  // Auth registered at the /ai prefix scope in app.ts (onRequest) so the
  // rate-limit keyGenerator can use request.userId.

  fastify.post<{ Body: z.infer<typeof generateInsightsSchema> }>(
    '/insights/generate',
    async (request, reply) => {
      try {
        const body = generateInsightsSchema.parse(request.body);
        const userId = requireUserId(request, reply);
        if (!userId) return;
        const result = await groqService.generateInsights(
          body.content,
          body.projectId ?? DEFAULT_PROJECT_ID,
          body.noteId,
          userId,
          body._meta
        );
        reply.code(200).send({ ok: true, data: result });
      } catch (error) {
        fastify.log.error(error);
        replyError(reply, error, 'Failed to generate insights');
      }
    }
  );

  fastify.post<{ Body: z.infer<typeof generatePRDSchema> }>(
    '/prd/generate',
    async (request, reply) => {
      try {
        const body = generatePRDSchema.parse(request.body);
        const userId = requireUserId(request, reply);
        if (!userId) return;
        const result = await groqService.generatePRD(
          body.title,
          body.notes,
          body.decisions,
          body.projectId ?? DEFAULT_PROJECT_ID,
          userId,
          body._meta
        );
        reply.code(201).send({ ok: true, data: result });
      } catch (error) {
        fastify.log.error(error);
        replyError(reply, error, 'Failed to generate PRD');
      }
    }
  );

  fastify.post<{ Body: z.infer<typeof suggestTasksSchema> }>(
    '/tasks/suggest',
    async (request, reply) => {
      try {
        const body = suggestTasksSchema.parse(request.body);
        const userId = requireUserId(request, reply);
        if (!userId) return;
        const result = await groqService.suggestTasks(
          body.prdContent,
          body.projectId ?? DEFAULT_PROJECT_ID,
          body.prdId,
          userId
        );
        reply.code(200).send({ ok: true, data: result });
      } catch (error) {
        fastify.log.error(error);
        replyError(reply, error, 'Failed to suggest tasks');
      }
    }
  );

  fastify.post<{ Body: z.infer<typeof analyzePatternsSchema> }>(
    '/patterns/analyze',
    async (request, reply) => {
      try {
        const body = analyzePatternsSchema.parse(request.body);
        const userId = requireUserId(request, reply);
        if (!userId) return;
        const result = await groqService.analyzePatterns(body.content, body.projectId, body.noteId, userId);
        reply.code(200).send({ ok: true, data: result });
      } catch (error) {
        fastify.log.error(error);
        replyError(reply, error, 'Failed to analyze patterns');
      }
    }
  );

  fastify.post<{ Body: z.infer<typeof scoreDecisionSchema> }>(
    '/decision/score',
    async (request, reply) => {
      try {
        const body = scoreDecisionSchema.parse(request.body);
        const userId = requireUserId(request, reply);
        if (!userId) return;
        const result = await groqService.scoreDecision(
          body.title,
          body.description,
          body.context,
          body.projectId,
          userId,
          body.decisionId
        );
        reply.code(200).send({ ok: true, data: result });
      } catch (error) {
        fastify.log.error(error);
        replyError(reply, error, 'Failed to score decision');
      }
    }
  );

  fastify.post<{ Body: z.infer<typeof analyzeSignalsSchema> }>(
    '/signals/analyze',
    async (request, reply) => {
      try {
        const body = analyzeSignalsSchema.parse(request.body);
        const userId = requireUserId(request, reply);
        if (!userId) return;
        const result = await groqService.analyzeSignals(
          body.content,
          userId,
          body.projectId ?? DEFAULT_PROJECT_ID
        );
        reply.code(200).send({ ok: true, data: result });
      } catch (error) {
        fastify.log.error(error);
        replyError(reply, error, 'Failed to analyze signals');
      }
    }
  );

  fastify.get(
    '/usage/:date',
    async (request: FastifyRequest<{ Params: { date: string } }>, reply) => {
      try {
        const userId = requireUserId(request, reply);
        if (!userId) return;
        const parsed = usageDateSchema.safeParse(request.params);
        if (!parsed.success) {
          reply.code(400).send({ ok: false, error: 'date must be YYYY-MM-DD' });
          return;
        }
        // Parse as UTC midnight; rows are stored at UTC day-start so a
        // findUnique on (userId, date) is exact.
        const [y, m, d] = parsed.data.date.split('-').map((s) => parseInt(s, 10));
        const dayStart = utcDayStart(new Date(Date.UTC(y, m - 1, d)));

        const db = groqService.getDb();
        const usage = await db.aPIUsage.findUnique({
          where: { userId_date: { userId, date: dayStart } },
        });

        reply.code(200).send({
          ok: true,
          data: usage ?? { message: 'No usage data for this date' },
        });
      } catch (error) {
        fastify.log.error(error);
        replyError(reply, error, 'Failed to get usage');
      }
    }
  );

  // ── SSE streaming PRD generation ────────────────────────────────────────────
  // Streams the PRD as Server-Sent Events so the frontend can show incremental
  // output without waiting for the full 4 000-token response.
  //
  // Event types:
  //   data: { chunk: "<text>" }     — incremental content
  //   data: { done: true }          — stream complete
  //   data: { error: "<message>" }  — terminal error
  fastify.post<{ Body: z.infer<typeof generatePRDSchema> }>(
    '/prd/stream',
    async (request, reply) => {
      const body = generatePRDSchema.safeParse(request.body);
      if (!body.success) {
        reply.code(400).send({ ok: false, error: 'Invalid request payload' });
        return;
      }
      const userId = requireUserId(request, reply);
      if (!userId) return;

      // Hijack the raw response to write SSE without buffering.
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',  // disable nginx buffering
        'Connection': 'keep-alive',
      });

      const write = (payload: Record<string, unknown>) => {
        reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
      };

      try {
        const gen = groqService.streamPRD(
          body.data.title,
          body.data.notes,
          body.data.decisions,
          body.data.projectId ?? DEFAULT_PROJECT_ID,
          userId
        );
        for await (const chunk of gen) {
          write({ chunk });
        }
        write({ done: true });
      } catch (err) {
        const { message } = classify(err);
        write({ error: message });
      } finally {
        reply.raw.end();
      }
    }
  );

  // ── Founder metrics ──────────────────────────────────────────────────────────
  // Production-safe endpoint for the founder dashboard. Unlike /internal/prompt-health
  // this is accessible in all environments — but only to authenticated users.
  // Returns aggregate API usage across ALL users (not just the caller).
  // In production only Firebase-admin-role users should call this; gating by
  // a header secret is the minimal guard until RBAC is implemented.
  fastify.get('/internal/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    // Guard: require a shared metrics token so arbitrary authed users can't
    // harvest aggregate usage. Set METRICS_TOKEN in env; omit to allow any
    // authenticated user (fine for private/internal deploys).
    const metricsToken = process.env.METRICS_TOKEN;
    if (metricsToken) {
      const provided = (request.headers['x-metrics-token'] as string | undefined) ?? '';
      if (provided !== metricsToken) {
        reply.code(403).send({ ok: false, error: 'Forbidden' });
        return;
      }
    }

    try {
      const db = groqService.getDb();
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalUsage,
        dailyTotals,
        modelBreakdown,
        topUsers,
        promptLogSummary,
        breaker,
      ] = await Promise.all([
        // Aggregate totals over the last 30 days.
        db.aPIUsage.aggregate({
          where: { date: { gte: since } },
          _sum: { totalRequests: true, totalTokens: true, totalCost: true },
          _count: { userId: true },
        }),

        // Daily trend — last 30 days, one row per day.
        db.aPIUsage.groupBy({
          by: ['date'],
          where: { date: { gte: since } },
          _sum: { totalRequests: true, totalTokens: true, totalCost: true },
          orderBy: { date: 'asc' },
        }),

        // Token usage by model over last 30 days.
        db.promptLog.groupBy({
          by: ['modelUsed'],
          where: { createdAt: { gte: since } },
          _sum: { totalTokens: true, cost: true },
          _count: { _all: true },
          orderBy: { _sum: { totalTokens: 'desc' } },
        }),

        // Top 10 users by token spend (anonymous — only userId exposed).
        db.aPIUsage.groupBy({
          by: ['userId'],
          where: { date: { gte: since } },
          _sum: { totalTokens: true, totalCost: true, totalRequests: true },
          orderBy: { _sum: { totalTokens: 'desc' } },
          take: 10,
        }),

        // Cache hit rate over last 30 days.
        db.promptLog.groupBy({
          by: ['cachedResult'],
          where: { createdAt: { gte: since } },
          _count: { _all: true },
        }),

        // Circuit breaker state.
        Promise.resolve(getCircuitBreakerState()),
      ]);

      const cacheHits = promptLogSummary.find((r) => r.cachedResult)?._count._all ?? 0;
      const cacheMisses = promptLogSummary.find((r) => !r.cachedResult)?._count._all ?? 0;
      const totalLogs = cacheHits + cacheMisses;

      reply.code(200).send({
        ok: true,
        data: {
          period: { since: since.toISOString(), until: new Date().toISOString() },
          totals: {
            requests: totalUsage._sum.totalRequests ?? 0,
            tokens: totalUsage._sum.totalTokens ?? 0,
            costUsd: Number((totalUsage._sum.totalCost ?? 0).toFixed(4)),
            activeUsers: totalUsage._count.userId,
          },
          cacheRate: totalLogs > 0 ? Number((cacheHits / totalLogs).toFixed(3)) : 0,
          dailyTrend: dailyTotals.map((r) => ({
            date: r.date.toISOString().slice(0, 10),
            requests: r._sum.totalRequests ?? 0,
            tokens: r._sum.totalTokens ?? 0,
            costUsd: Number((r._sum.totalCost ?? 0).toFixed(4)),
          })),
          modelBreakdown: modelBreakdown.map((r) => ({
            model: r.modelUsed,
            calls: r._count._all,
            tokens: r._sum.totalTokens ?? 0,
            costUsd: Number((r._sum.cost ?? 0).toFixed(4)),
          })),
          topUsers: topUsers.map((r) => ({
            userId: r.userId,
            tokens: r._sum.totalTokens ?? 0,
            requests: r._sum.totalRequests ?? 0,
            costUsd: Number((r._sum.totalCost ?? 0).toFixed(4)),
          })),
          circuitBreaker: {
            state: breaker.state,
            failures: breaker.failures,
            lastFailureAt: breaker.lastFailureAt > 0 ? new Date(breaker.lastFailureAt).toISOString() : null,
          },
        },
      });
    } catch (err) {
      fastify.log.error(err);
      replyError(reply, err, 'Failed to fetch metrics');
    }
  });

  // v2.3 internal prompt-health aggregation. Dev-only — gated by NODE_ENV so
  // production users can never see another user's prompt usage telemetry.
  // Returns a per-(promptId, promptVersion) summary over the last 14 days.
  fastify.get('/internal/prompt-health', async (request, reply) => {
    if (process.env.NODE_ENV === 'production') {
      reply.code(404).send({ ok: false, error: 'Not found' });
      return;
    }
    try {
      const userId = requireUserId(request, reply);
      if (!userId) return;

      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const db = groqService.getDb();

      // Aggregate per (promptId, promptVersion). Filter to rows that actually
      // carry registry metadata so legacy null rows don't dominate the table.
      const rows = await db.promptLog.groupBy({
        by: ['promptId', 'promptVersion'],
        where: {
          userId,
          createdAt: { gte: since },
          NOT: { promptId: null },
        },
        _avg: { executionMs: true, inputTokens: true, outputTokens: true, cost: true },
        _count: { _all: true },
        _sum: { totalTokens: true, cost: true },
      });

      const data = rows.map((r) => ({
        promptId: r.promptId,
        promptVersion: r.promptVersion,
        usageCount: r._count._all,
        avgLatencyMs: Math.round(r._avg.executionMs ?? 0),
        avgInputTokens: Math.round(r._avg.inputTokens ?? 0),
        avgOutputTokens: Math.round(r._avg.outputTokens ?? 0),
        totalTokens: r._sum.totalTokens ?? 0,
        totalCostUsd: Number((r._sum.cost ?? 0).toFixed(4)),
      }));

      reply.code(200).send({ ok: true, data: { sinceIso: since.toISOString(), rows: data } });
    } catch (error) {
      fastify.log.error(error);
      replyError(reply, error, 'Failed to aggregate prompt health');
    }
  });
}
