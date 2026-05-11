// Learning loop service — generates AI insights from outcome deltas and evolves
// Product Brain confidence scores. Called by the learningWorker and outcomeRoutes.

import { db } from '../lib/db.js';
import { getGroqClient } from './groqService.js';
import { publishEvent } from './eventBus.js';

interface OutcomeContext {
  outcomeId: string;
  userId: string;
  decisionId: string;
  decisionTitle: string;
  expectedMetric: string;
  expectedValue: number;
  actualValue: number;
  deviationPct: number;
  verdict: string;  // exceeded | met | missed | far_off
}

interface LearningResult {
  insightId: string;
  insight: string;
  rootCause: string;
  actionableNext: string;
  confidenceShift: number;
  tags: string[];
}

// Derive confidence shift from verdict and deviation magnitude.
const computeConfidenceShift = (verdict: string, deviationPct: number): number => {
  const abs = Math.abs(deviationPct);
  switch (verdict) {
    case 'exceeded': return Math.min(0.15, 0.05 + abs / 400);
    case 'met':      return 0.05;
    case 'missed':   return Math.max(-0.15, -0.05 - abs / 400);
    case 'far_off':  return Math.max(-0.25, -0.10 - abs / 300);
    default:         return 0;
  }
};

const LEARNING_PROMPT = (ctx: OutcomeContext) => `
You are SPECKULA's Learning Engine. A product decision has a recorded outcome.
Analyse the delta between expected and actual, then produce a concise learning insight.

Decision: "${ctx.decisionTitle}"
Expected: ${ctx.expectedValue} ${ctx.expectedMetric}
Actual: ${ctx.actualValue} ${ctx.expectedMetric}
Deviation: ${ctx.deviationPct > 0 ? '+' : ''}${ctx.deviationPct.toFixed(1)}%
Verdict: ${ctx.verdict.toUpperCase().replace('_', ' ')}

Respond ONLY with valid JSON matching this schema:
{
  "insight": "1-3 sentence synthesis of what happened",
  "rootCause": "most likely explanation for the delta",
  "actionableNext": "single concrete action for the next decision cycle",
  "tags": ["tag1", "tag2"]
}
`.trim();

export const generateLearningInsight = async (ctx: OutcomeContext): Promise<LearningResult> => {
  const confidenceShift = computeConfidenceShift(ctx.verdict, ctx.deviationPct);

  const prompt = LEARNING_PROMPT(ctx);

  // Use Groq for fast, cheap insight generation.
  let parsed: { insight: string; rootCause: string; actionableNext: string; tags: string[] };
  let modelUsed = 'llama-3.3-70b-versatile';
  let tokensUsed = 0;

  try {
    const response = await getGroqClient().chat.completions.create({
      model: modelUsed,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    });
    const raw = response.choices[0]?.message?.content ?? '{}';
    parsed = JSON.parse(raw);
    tokensUsed = response.usage?.total_tokens ?? 0;
  } catch {
    // Fallback: rule-based insight when AI fails.
    parsed = {
      insight: `The decision "${ctx.decisionTitle}" ${ctx.verdict === 'exceeded' || ctx.verdict === 'met' ? 'performed as expected or better' : 'underperformed'} with a ${Math.abs(ctx.deviationPct).toFixed(0)}% deviation from the target.`,
      rootCause: 'AI insight generation unavailable — review metrics manually.',
      actionableNext: ctx.verdict === 'missed' || ctx.verdict === 'far_off'
        ? 'Validate assumptions before the next iteration.'
        : 'Document what drove the positive result for future decisions.',
      tags: [ctx.verdict, 'manual-fallback'],
    };
  }

  const record = await db.learningInsight.create({
    data: {
      userId:          ctx.userId,
      outcomeId:       ctx.outcomeId,
      decisionId:      ctx.decisionId,
      insight:         parsed.insight ?? '',
      rootCause:       parsed.rootCause ?? null,
      actionableNext:  parsed.actionableNext ?? null,
      confidenceShift,
      tags:            JSON.stringify(parsed.tags ?? []),
      modelUsed,
      tokensUsed,
    },
  });

  // Mark the outcome as analyzed and store the confidence delta.
  await db.outcome.update({
    where: { id: ctx.outcomeId },
    data:  { status: 'analyzed', confidenceDelta: confidenceShift },
  });

  // Update any ProductBrainEntries tagged with this decisionId.
  const brainEntries = await db.productBrainEntry.findMany({
    where: { userId: ctx.userId, entryType: 'strategic_decision' },
    select: { id: true, confidence: true, metadata: true },
  });

  for (const entry of brainEntries) {
    try {
      const meta = JSON.parse(entry.metadata ?? '{}') as Record<string, unknown>;
      if (meta.decisionId !== ctx.decisionId) continue;
      const nextConfidence = Math.min(1, Math.max(0, entry.confidence + confidenceShift));
      await db.productBrainEntry.update({
        where: { id: entry.id },
        data:  { confidence: nextConfidence },
      });
    } catch {
      // Non-parseable metadata — skip.
    }
  }

  // Publish realtime events.
  await publishEvent({
    type:   'learning.generated',
    userId: ctx.userId,
    data:   { insightId: record.id, decisionId: ctx.decisionId, confidenceShift },
  });

  await publishEvent({
    type:   'product_brain.updated',
    userId: ctx.userId,
    data:   { entryId: record.id, entryType: 'learning_insight', confidence: Math.max(0, 0.5 + confidenceShift) },
  });

  return {
    insightId:       record.id,
    insight:         parsed.insight ?? '',
    rootCause:       parsed.rootCause ?? '',
    actionableNext:  parsed.actionableNext ?? '',
    confidenceShift,
    tags:            parsed.tags ?? [],
  };
};

// Fetch all learning insights for a user, optionally filtered by decisionId.
export const getLearningInsights = async (userId: string, decisionId?: string) => {
  return db.learningInsight.findMany({
    where: { userId, ...(decisionId ? { decisionId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
};
