import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { groqService } from '../services/groqService.js';
import { z } from 'zod';
import { utcDayStart } from '../lib/dateUtils.js';

const MAX_CONTENT_CHARS = 80_000;

const generateInsightsSchema = z.object({
  projectId: z.string().min(1).optional(),
  noteId: z.string().min(1),
  content: z.string().min(1).max(MAX_CONTENT_CHARS),
}).strict();

const generatePRDSchema = z.object({
  projectId: z.string().min(1).optional(),
  title: z.string().min(1).max(200),
  notes: z.string().min(1).max(MAX_CONTENT_CHARS),
  decisions: z.string().max(MAX_CONTENT_CHARS).optional().default(""),
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
  content: z.string().min(1).max(MAX_CONTENT_CHARS),
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
  const status = (error as { status?: number; statusCode?: number })?.status
    ?? (error as { status?: number; statusCode?: number })?.statusCode;
  if (typeof status === 'number') {
    if (status === 429) return { status: 429, message: 'Upstream rate limit reached. Try again shortly.' };
    if (status >= 500) return { status: 502, message: 'Upstream AI service error' };
  }
  // Default: treat unknown errors as 500 with a generic message; specific
  // routes can override before calling this if they have a known cause.
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
          userId
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
          userId
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
}
