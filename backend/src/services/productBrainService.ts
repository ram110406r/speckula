// Product Brain service — persistent startup memory graph.
// Stores AI-generated intelligence and connects entries to embeddings for
// semantic retrieval.

import { db } from '../lib/db.js';
import { generateEmbedding, saveEmbedding, semanticSearch } from './embeddingService.js';
import { publishEvent } from './eventBus.js';

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

    return entry.id;
  },

  // Store a competitor insight and save it to the Product Brain.
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
    const insight = await db.competitorInsight.create({
      data: {
        userId,
        workspaceId:    data.workspaceId ?? null,
        domain:         data.domain,
        competitorName: data.competitorName ?? null,
        insightType:    data.insightType,
        title:          data.title,
        content:        data.content,
        evidence:       data.evidence ? JSON.stringify(data.evidence) : undefined,
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

    publishEvent({
      type: 'competitor.updated',
      userId,
      data: { domain: data.domain, insightType: data.insightType },
    }).catch(() => undefined);

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

  // Internal: embed an entry and update its embeddingId.
  async embedEntry(entryId: string, title: string, content: string): Promise<void> {
    const text = `${title}\n\n${content}`;
    const embedding = await generateEmbedding(text);
    if (!embedding) return;
    const embeddingId = await saveEmbedding(entryId, embedding);
    if (embeddingId) {
      await db.productBrainEntry.update({
        where: { id: entryId },
        data: { embeddingId },
      }).catch(() => undefined);
    }
  },
};
