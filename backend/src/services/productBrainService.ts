// Product Brain service — persistent startup memory graph.
// Stores AI-generated intelligence and connects entries to embeddings for
// semantic retrieval.

import { db } from '../lib/db.js';
import { generateEmbedding, saveEmbedding, semanticSearch } from './embeddingService.js';
import { publishEvent, publishWorkspaceEvent } from './eventBus.js';
import { workspaceActivityService } from './workspaceActivityService.js';

export type EntryType =
  | 'competitor_insight'
  | 'market_signal'
  | 'pm_insight'
  | 'pricing_observation'
  | 'onboarding_pattern'
  | 'feature_comparison'
  | 'strategic_decision'
  | 'ux_friction'
  | 'icp_inference';

export interface ProductBrainInput {
  userId: string;
  workspaceId?: string | null;
  entryType: EntryType;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  sourceUrl?: string | null;
  sourceJobId?: string | null;
  confidence?: number;
  tags?: string[];
  decisionId?: string | null;
}

export const productBrainService = {
  // Create a new Product Brain entry and generate its embedding asynchronously.
  async create(input: ProductBrainInput): Promise<string> {
    const entry = await db.productBrainEntry.create({
      data: {
        userId:      input.userId,
        workspaceId: input.workspaceId ?? null,
        entryType:   input.entryType,
        title:       input.title,
        content:     input.content,
        metadata:    input.metadata ? JSON.stringify(input.metadata) : undefined,
        sourceUrl:   input.sourceUrl ?? null,
        sourceJobId: input.sourceJobId ?? null,
        confidence:  input.confidence ?? 0.7,
        tags:        input.tags ? JSON.stringify(input.tags) : undefined,
        decisionId:  input.decisionId ?? null,
      },
    });

    // Generate and persist embedding asynchronously — don't block the caller.
    this.embedEntry(entry.id, input.title, input.content).catch(() => undefined);

    // Publish event so WebSocket clients see the new entry immediately.
    publishEvent({
      type: 'insight.created',
      userId: input.userId,
      data: { entryId: entry.id, entryType: input.entryType, title: input.title },
    }).catch(() => undefined);

    if (input.workspaceId) {
      publishWorkspaceEvent({
        type: 'insight.created',
        workspaceId: input.workspaceId,
        userId: input.userId,
        data: { entryId: entry.id, entryType: input.entryType, title: input.title },
      }).catch(() => undefined);

      workspaceActivityService.create({
        workspaceId: input.workspaceId,
        actorId: input.userId,
        eventType: 'insight.created',
        title: input.title,
        description: input.content.slice(0, 240),
        entityType: 'ProductBrainEntry',
        entityId: entry.id,
        metadata: { entryType: input.entryType },
      }).catch(() => undefined);
    }

    return entry.id;
  },

  // Store a competitor insight and save it to the Product Brain.
  // Skips insert if an identical insight (same domain + type + title) exists within 24 h.
  async saveCompetitorInsight(
    userId: string,
    data: {
      domain: string;
      competitorName?: string;
      insightType: string;
      title: string;
      content: string;
      evidence?: string[];
      sourceUrl?: string;
      confidence?: number;
      sourceJobId?: string;
      workspaceId?: string;
    }
  ): Promise<string> {
    // Deduplication — skip near-identical insights captured in the last 24 hours.
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const duplicate = await db.competitorInsight.findFirst({
      where: {
        userId,
        domain:      data.domain,
        insightType: data.insightType,
        title:       data.title,
        capturedAt:  { gte: since24h },
      },
      select: { id: true },
    });
    if (duplicate) {
      return duplicate.id;
    }

    const insight = await db.competitorInsight.create({
      data: {
        userId,
        workspaceId:    data.workspaceId ?? null,
        domain:         data.domain,
        competitorName: data.competitorName ?? null,
        insightType:    data.insightType,
        title:          data.title,
        content:        data.content,
        evidence:       data.evidence && data.evidence.length > 0 ? JSON.stringify(data.evidence) : undefined,
        sourceUrl:      data.sourceUrl ?? null,
        confidence:     data.confidence ?? 0.7,
        sourceJobId:    data.sourceJobId ?? null,
      },
    });

    // Mirror to Product Brain for cross-type semantic search.
    await this.create({
      userId,
      workspaceId:  data.workspaceId,
      entryType:    'competitor_insight',
      title:        data.title,
      content:      data.content,
      sourceUrl:    data.sourceUrl,
      sourceJobId:  data.sourceJobId,
      confidence:   data.confidence,
      metadata:     { domain: data.domain, competitorName: data.competitorName, insightType: data.insightType },
      tags:         [data.domain, data.insightType],
    });

    // Scoped competitor event so the frontend only refetches on actual competitor data.
    publishEvent({
      type: 'competitor.insight.created',
      userId,
      data: { domain: data.domain, insightType: data.insightType, title: data.title },
    }).catch(() => undefined);

    publishEvent({
      type: 'competitor.updated',
      userId,
      data: { domain: data.domain, insightType: data.insightType },
    }).catch(() => undefined);

    if (data.workspaceId) {
      publishWorkspaceEvent({
        type: 'competitor.insight.created',
        workspaceId: data.workspaceId,
        userId,
        data: { domain: data.domain, insightType: data.insightType, title: data.title },
      }).catch(() => undefined);

      publishWorkspaceEvent({
        type: 'competitor.updated',
        workspaceId: data.workspaceId,
        userId,
        data: { domain: data.domain, insightType: data.insightType },
      }).catch(() => undefined);

      workspaceActivityService.create({
        workspaceId: data.workspaceId,
        actorId: userId,
        eventType: 'competitor.updated',
        title: data.title,
        description: data.content.slice(0, 240),
        entityType: 'CompetitorInsight',
        entityId: insight.id,
        metadata: { domain: data.domain, insightType: data.insightType },
      }).catch(() => undefined);
    }

    return insight.id;
  },

  // Store a market signal and save it to the Product Brain.
  async saveMarketSignal(
    userId: string,
    data: {
      signalType: string;
      title: string;
      content: string;
      sourceUrl?: string;
      strength?: number;
      tags?: string[];
      sourceJobId?: string;
      workspaceId?: string;
    }
  ): Promise<string> {
    const signal = await db.marketSignal.create({
      data: {
        userId,
        workspaceId: data.workspaceId ?? null,
        signalType:  data.signalType,
        title:       data.title,
        content:     data.content,
        sourceUrl:   data.sourceUrl ?? null,
        strength:    data.strength ?? 0.5,
        tags:        data.tags ? JSON.stringify(data.tags) : undefined,
        sourceJobId: data.sourceJobId ?? null,
      },
    });

    await this.create({
      userId,
      workspaceId: data.workspaceId,
      entryType:   'market_signal',
      title:       data.title,
      content:     data.content,
      sourceUrl:   data.sourceUrl,
      sourceJobId: data.sourceJobId,
      confidence:  data.strength ?? 0.5,
      tags:        data.tags,
      metadata:    { signalType: data.signalType },
    });

    publishEvent({
      type: 'market_signal.detected',
      userId,
      data: { signalId: signal.id, signalType: data.signalType, title: data.title },
    }).catch(() => undefined);

    if (data.workspaceId) {
      publishWorkspaceEvent({
        type: 'market_signal.detected',
        workspaceId: data.workspaceId,
        userId,
        data: { signalId: signal.id, signalType: data.signalType, title: data.title },
      }).catch(() => undefined);

      workspaceActivityService.create({
        workspaceId: data.workspaceId,
        actorId: userId,
        eventType: 'market_signal.detected',
        title: data.title,
        description: data.content.slice(0, 240),
        entityType: 'MarketSignal',
        entityId: signal.id,
        metadata: { signalType: data.signalType, strength: data.strength },
      }).catch(() => undefined);
    }

    return signal.id;
  },

  // Semantic search across all Product Brain entries for a user.
  async search(
    userId: string,
    query: string,
    options: { limit?: number; entryType?: EntryType; workspaceId?: string } = {}
  ) {
    const similar = await semanticSearch(query, userId, options);
    if (similar.length === 0) return [];

    const ids = similar.map((r) => r.entryId);
    const entries = await db.productBrainEntry.findMany({
      where: { id: { in: ids } },
    });

    // Re-order by similarity distance.
    const distMap = new Map(similar.map((r) => [r.entryId, r.distance]));
    return entries
      .map((e) => ({ ...e, similarity: 1 - (distMap.get(e.id) ?? 1) }))
      .sort((a, b) => b.similarity - a.similarity);
  },

  // Create notification for a user and push via WebSocket.
  async notify(userId: string, type: string, title: string, body: string, metadata?: Record<string, unknown>): Promise<void> {
    const note = await db.notification.create({
      data: { userId, type, title, body, metadata: metadata ? JSON.stringify(metadata) : undefined },
    });
    publishEvent({
      type: 'notification.created',
      userId,
      data: { notificationId: note.id, type, title },
    }).catch(() => undefined);
  },

  // Internal: embed an entry and update its embeddingId + embeddingStatus.
  async embedEntry(entryId: string, title: string, content: string): Promise<void> {
    try {
      const text = `${title}\n\n${content}`;
      const embedding = await generateEmbedding(text);
      if (!embedding) {
        await db.productBrainEntry.update({
          where: { id: entryId },
          data: { embeddingStatus: 'failed' },
        }).catch(() => undefined);
        return;
      }
      const embeddingId = await saveEmbedding(entryId, embedding);
      await db.productBrainEntry.update({
        where: { id: entryId },
        data: {
          embeddingId: embeddingId ?? undefined,
          embeddingStatus: embeddingId ? 'done' : 'failed',
        },
      }).catch(() => undefined);
    } catch {
      await db.productBrainEntry.update({
        where: { id: entryId },
        data: { embeddingStatus: 'failed' },
      }).catch(() => undefined);
    }
  },
};
