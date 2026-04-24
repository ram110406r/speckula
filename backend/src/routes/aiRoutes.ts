import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { groqService } from '../services/groqService';
import { z } from 'zod';

// Validation schemas
const generateInsightsSchema = z.object({
  projectId: z.string(),
  noteId: z.string(),
  content: z.string(),
  userId: z.string(),
});

const generatePRDSchema = z.object({
  projectId: z.string(),
  title: z.string(),
  notes: z.string(),
  decisions: z.string(),
  userId: z.string(),
});

const suggestTasksSchema = z.object({
  projectId: z.string(),
  prdContent: z.string(),
  prdId: z.string().optional(),
  userId: z.string(),
});

const analyzePatternsSchema = z.object({
  projectId: z.string(),
  noteId: z.string(),
  content: z.string(),
  userId: z.string(),
});

const scoreDecisionSchema = z.object({
  projectId: z.string(),
  decisionId: z.string(),
  title: z.string(),
  description: z.string(),
  context: z.string(),
  userId: z.string(),
});

export default async function aiRoutes(fastify: FastifyInstance) {
  /**
   * POST /ai/insights/generate
   * Generate insights from note content using Groq
   */
  fastify.post<{ Body: z.infer<typeof generateInsightsSchema> }>(
    '/insights/generate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = generateInsightsSchema.parse(request.body);
        
        const result = await groqService.generateInsights(
          body.content,
          body.projectId,
          body.noteId,
          body.userId
        );

        reply.code(200).send({
          ok: true,
          data: result,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(400).send({
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to generate insights',
        });
      }
    }
  );

  /**
   * POST /ai/prd/generate
   * Generate PRD from notes and decisions using Groq (llama3-70b)
   */
  fastify.post<{ Body: z.infer<typeof generatePRDSchema> }>(
    '/prd/generate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = generatePRDSchema.parse(request.body);

        const result = await groqService.generatePRD(
          body.title,
          body.notes,
          body.decisions,
          body.projectId,
          body.userId
        );

        reply.code(201).send({
          ok: true,
          data: result,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(400).send({
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to generate PRD',
        });
      }
    }
  );

  /**
   * POST /ai/tasks/suggest
   * Suggest tasks from PRD using Groq (mixtral for speed)
   */
  fastify.post<{ Body: z.infer<typeof suggestTasksSchema> }>(
    '/tasks/suggest',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = suggestTasksSchema.parse(request.body);

        const result = await groqService.suggestTasks(
          body.prdContent,
          body.projectId,
          body.prdId,
          body.userId
        );

        reply.code(200).send({
          ok: true,
          data: result,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(400).send({
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to suggest tasks',
        });
      }
    }
  );

  /**
   * POST /ai/patterns/analyze
   * Analyze patterns in real-time (fast response with mixtral)
   */
  fastify.post<{ Body: z.infer<typeof analyzePatternsSchema> }>(
    '/patterns/analyze',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = analyzePatternsSchema.parse(request.body);

        const result = await groqService.analyzePatterns(
          body.content,
          body.projectId,
          body.noteId,
          body.userId
        );

        reply.code(200).send({
          ok: true,
          data: result,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(400).send({
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to analyze patterns',
        });
      }
    }
  );

  /**
   * POST /ai/decision/score
   * Score decision confidence using Groq reasoning model
   */
  fastify.post<{ Body: z.infer<typeof scoreDecisionSchema> }>(
    '/decision/score',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = scoreDecisionSchema.parse(request.body);

        const result = await groqService.scoreDecision(
          body.title,
          body.description,
          body.context,
          body.projectId,
          body.userId,
          body.decisionId
        );

        reply.code(200).send({
          ok: true,
          data: result,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(400).send({
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to score decision',
        });
      }
    }
  );

  /**
   * GET /ai/usage
   * Get API usage stats for cost tracking
   */
  fastify.get(
    '/usage/:userId/:date',
    async (
      request: FastifyRequest<{ Params: { userId: string; date: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId, date } = request.params;
        const queryDate = new Date(date);
        const db = groqService.getDb();

        const usage = await db.aPIUsage.findFirst({
          where: {
            userId,
            date: {
              gte: new Date(queryDate.setHours(0, 0, 0, 0)),
              lte: new Date(queryDate.setHours(23, 59, 59, 999)),
            },
          },
        });

        reply.code(200).send({
          ok: true,
          data: usage || { message: 'No usage data for this date' },
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(400).send({
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to get usage',
        });
      }
    }
  );
}
