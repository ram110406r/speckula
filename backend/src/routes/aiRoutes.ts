import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { groqService } from '../services/groqService.js';
import { verifyFirebaseAuth } from '../lib/firebaseAuth.js';
import { z } from 'zod';

const generateInsightsSchema = z.object({
  projectId: z.string().min(1),
  noteId: z.string().min(1),
  content: z.string().min(1),
});

const generatePRDSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  notes: z.string().min(1),
  decisions: z.string(),
});

const suggestTasksSchema = z.object({
  projectId: z.string().min(1),
  prdContent: z.string().min(1),
  prdId: z.string().min(1).optional(),
});

const analyzePatternsSchema = z.object({
  projectId: z.string().min(1),
  noteId: z.string().min(1),
  content: z.string().min(1),
});

const scoreDecisionSchema = z.object({
  projectId: z.string().min(1),
  decisionId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  context: z.string(),
});

// `userId` comes from the verified Firebase ID token, never from the request body.
// A non-null assertion is safe because verifyFirebaseAuth rejects requests without a valid token.
const requireUserId = (request: FastifyRequest): string => request.userId as string;

const replyError = (reply: FastifyReply, error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  reply.code(400).send({ ok: false, error: message });
};

export default async function aiRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyFirebaseAuth);

  fastify.post<{ Body: z.infer<typeof generateInsightsSchema> }>(
    '/insights/generate',
    async (request, reply) => {
      try {
        const body = generateInsightsSchema.parse(request.body);
        const userId = requireUserId(request);
        const result = await groqService.generateInsights(body.content, body.projectId, body.noteId, userId);
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
        const userId = requireUserId(request);
        const result = await groqService.generatePRD(body.title, body.notes, body.decisions, body.projectId, userId);
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
        const userId = requireUserId(request);
        const result = await groqService.suggestTasks(body.prdContent, body.projectId, body.prdId, userId);
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
        const userId = requireUserId(request);
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
        const userId = requireUserId(request);
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

  fastify.get(
    '/usage/:date',
    async (request: FastifyRequest<{ Params: { date: string } }>, reply) => {
      try {
        const userId = requireUserId(request);
        const queryDate = new Date(request.params.date);
        if (Number.isNaN(queryDate.getTime())) {
          reply.code(400).send({ ok: false, error: 'Invalid date' });
          return;
        }

        const dayStart = new Date(queryDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(queryDate);
        dayEnd.setHours(23, 59, 59, 999);

        const db = groqService.getDb();
        const usage = await db.aPIUsage.findFirst({
          where: { userId, date: { gte: dayStart, lte: dayEnd } },
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
