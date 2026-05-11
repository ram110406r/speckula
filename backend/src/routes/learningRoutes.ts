// Learning routes — retrieve AI-generated insights from outcome analysis.
// Insights are created automatically when an actual outcome is recorded.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../lib/db.js';
import { getLearningInsights } from '../services/learningService.js';

const requireUserId = (req: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = req.userId;
  if (!uid) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return null; }
  return uid;
};

export default async function learningRoutes(fastify: FastifyInstance) {

  // GET /learning — list learning insights, optionally filtered by decisionId.
  fastify.get('/', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { decisionId } = req.query as { decisionId?: string };

    const insights = await getLearningInsights(userId, decisionId);
    reply.code(200).send({ ok: true, data: { insights } });
  });

  // GET /learning/:id — fetch a single insight with its parent outcome.
  fastify.get('/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const insight = await db.learningInsight.findFirst({
      where:   { id, userId },
      include: { outcome: true },
    });

    if (!insight) return reply.code(404).send({ ok: false, error: 'insight not found' });
    reply.code(200).send({ ok: true, data: { insight } });
  });

  // GET /learning/summary — aggregate confidence shift across all insights.
  fastify.get('/summary', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;

    const insights = await db.learningInsight.findMany({
      where:  { userId },
      select: { confidenceShift: true, createdAt: true, decisionId: true },
    });

    const totalShift       = insights.reduce((s, i) => s + (i.confidenceShift ?? 0), 0);
    const positiveInsights = insights.filter((i) => (i.confidenceShift ?? 0) > 0).length;
    const negativeInsights = insights.filter((i) => (i.confidenceShift ?? 0) < 0).length;

    // Last 30 days trend.
    const since30d    = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recent      = insights.filter((i) => i.createdAt >= since30d);
    const recentShift = recent.reduce((s, i) => s + (i.confidenceShift ?? 0), 0);

    reply.code(200).send({
      ok: true,
      data: {
        totalInsights:     insights.length,
        totalShift:        Math.round(totalShift * 1000) / 1000,
        positiveInsights,
        negativeInsights,
        recentShift:       Math.round(recentShift * 1000) / 1000,
        uniqueDecisions:   new Set(insights.map((i) => i.decisionId)).size,
      },
    });
  });
}
