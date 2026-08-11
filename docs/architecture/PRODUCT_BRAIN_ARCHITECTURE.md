# SPECKULA — Product Brain Architecture & Learning Engine

## 1. Product Brain Overview

The **Product Brain** is SPECKULA's persistent institutional memory graph. It continuously captures insights from research notes, web scraping, competitor tracking, Slack messages, and product decisions to provide contextual grounding for all AI reasoning operations.

```text
[ Signals / Transcripts / Web Content ]
                   │
                   ▼
     [ Analysis Worker / API ]
                   │
                   ▼
     [ ProductBrainEntry Creation ]
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
 [ OpenAI Embeddings ] [ PostgreSQL Table ]
 (text-embedding-3)   ("ProductBrainEntry")
         │                   │
         ▼                   ▼
[ SemanticEmbedding ] ──(FK)─┘
(pgvector 1536 dims)
```

---

## 2. Memory Types & Schema Mapping

The `ProductBrainEntry` model supports 9 specialized entry types (`EntryType`):

| Entry Type | Purpose / Source | Example Insight |
|---|---|---|
| `competitor_insight` | Competitor feature launch or positioning shift | "Competitor X launched team seats at $29/mo" |
| `market_signal` | Customer pain point or broader market trend | "60% of PMs report tool fragmentation in discovery" |
| `pm_insight` | Derived PM observation from TipTap research editor | "Users drop off during manual data entry step" |
| `pricing_observation` | Monitored tier change or competitor pricing model | "Competitor Y removed free plan, starting at $15/mo" |
| `onboarding_pattern` | Onboarding UX pattern discovered on web page | "Competitor Z uses 3-step interactive onboarding flow" |
| `feature_comparison` | Side-by-side feature gap matrix | "Our product lacks automated Jira sync vs Market Leader" |
| `strategic_decision` | Saved product decision with justification | "Decided to focus on AI PRD generation before tasks" |
| `ux_friction` | User pain point or UI friction report | "Users struggle to locate export options on mobile" |
| `icp_inference` | Inferred Ideal Customer Profile characteristics | "Primary ICP is seed-stage founders and Solo PMs" |

---

## 3. Retrieval & Semantic Search Engine

Vector similarity search is implemented in `embeddingService.ts` via `pgvector`'s cosine distance operator (`<=>`):

```typescript
export const semanticSearch = async (
  queryText: string,
  userId: string,
  options: { limit?: number; entryType?: string; workspaceId?: string } = {}
) => {
  const embedding = await generateEmbedding(queryText);
  if (!embedding) return [];
  const vectorLiteral = `[${embedding.join(',')}]`;

  return db.$queryRaw<Row[]>(Prisma.sql`
    SELECT se."entryId", (se."embedding" <=> ${vectorLiteral}::vector) AS distance
    FROM "SemanticEmbedding" se
    JOIN "ProductBrainEntry" pbe ON pbe."id" = se."entryId"
    WHERE pbe."userId" = ${userId}
    ${entryTypeFilter}
    ${workspaceFilter}
    ORDER BY distance ASC
    LIMIT ${limit}
  `);
};
```

---

## 4. Closed-Loop Learning System

SPECKULA links pre-launch strategic assumptions to post-launch actual results through the **Outcome Learning Loop**:

```text
[ Decision Created ] ──> [ Outcome Defined ] ──> [ Actual Result Recorded ]
                                                          │
                                                          ▼
                                              [ Outcome Deviation Computed ]
                                                          │
                                                          ▼
                                             [ LearningInsight Generated ]
                                                          │
                                                          ▼
                                             [ Brain Confidence Updated ]
```

1. **Outcome Definition**: When a decision is made, the PM inputs an `expectedMetric`, `expectedValue`, and `timeframe`.
2. **Actual Recording**: Post-launch, actual performance metrics are submitted via `POST /outcomes/:id/actual`.
3. **Deviation Calculation**: Computes `deviationPct = ((actual - expected) / expected) * 100` and assigns a verdict (`exceeded`, `met`, `missed`, `far_off`).
4. **Learning Insight Generation**: Groq LLM analyzes the gap, identifies root causes, and creates a `LearningInsight` record.
5. **Confidence Calibration**: Adjusts confidence scores across linked `ProductBrainEntry` entries (+0.1 for `exceeded`, -0.15 for `far_off`), ensuring future AI decisions learn from past accuracy.
