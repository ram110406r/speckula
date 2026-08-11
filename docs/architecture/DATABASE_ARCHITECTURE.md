# SPECKULA — Database Architecture & Schema Audit

## 1. Schema Overview & Domain Groups

The PostgreSQL database (managed via Prisma v7 ORM) contains **30 models** categorized into 8 functional domains:

```text
Identity & Workspaces: Workspace, WorkspaceMember, WorkspaceActivity, WorkspaceMetrics, WorkspaceContext
Product Intelligence:  ProductBrainEntry, SemanticEmbedding, CompetitorInsight, CompetitorMonitor, MarketSignal
Decision & Outcomes:   DecisionReasoning, Outcome, LearningInsight
Planning & Execution:  RoadmapItem, Experiment, ExperimentVariant
AI Telemetry & Cache:  AIInsight, AIPRD, AISuggestedTask, PromptLog, PromptCache, APIUsage
Agent Infrastructure:  Agent, AgentRun
Extension Capture:     ExtensionSession, ExtensionHeartbeat, AnalysisJob
System & Infrastructure: Notification, ActivityLog, WebSocketConnection
```

---

## 2. Complete Model Matrix & Storage Audit

| Model Name | Primary Key | Key Foreign Keys / Indexes | Uniqueness Constraints | Primary Purpose |
|---|---|---|---|---|
| `Workspace` | `id` (UUID) | `ownerId`, `slug` | `slug` | Shared team context & organization boundary |
| `WorkspaceMember` | `id` (UUID) | `workspaceId`, `userId` | `(workspaceId, userId)` | User role in workspace (`owner`, `admin`, `editor`, `viewer`) |
| `WorkspaceActivity` | `id` (UUID) | `(workspaceId, createdAt)`, `actorId` | None | Audit stream for workspace-scoped actions |
| `WorkspaceMetrics` | `id` (UUID) | `workspaceId` | `workspaceId` | Real-time rollups of signals/decisions/tasks |
| `WorkspaceContext` | `id` (UUID) | `workspaceId` | `workspaceId` | Injected startup context blob for LLM prompts |
| `ProductBrainEntry` | `id` (UUID) | `userId`, `workspaceId`, `embeddingId`, `(userId, decisionId)` | `embeddingId` | Core knowledge graph entry |
| `SemanticEmbedding` | `id` (UUID) | `entryId` | `entryId` | `pgvector` vector store (1536 dims) |
| `CompetitorInsight` | `id` (UUID) | `userId`, `domain`, `capturedAt` | None | Captured competitor pricing/features |
| `CompetitorMonitor` | `id` (UUID) | `userId`, `domain`, `workspaceId` | `(userId, domain)` | Domain tracking registry |
| `MarketSignal` | `id` (UUID) | `userId`, `signalType`, `detectedAt` | None | Extracted market trends and pain points |
| `DecisionReasoning` | `id` (UUID) | `decisionId`, `userId`, `projectId` | `decisionId` | AI rationale for decision scores |
| `Outcome` | `id` (UUID) | `userId`, `decisionId`, `status` | None | Pre-launch target vs post-launch actual metric |
| `LearningInsight` | `id` (UUID) | `userId`, `outcomeId`, `decisionId` | None | AI post-mortem learning loop entry |
| `RoadmapItem` | `id` (UUID) | `userId`, `workspaceId`, `quarter` | None | Quarter-scoped planned items |
| `Experiment` | `id` (UUID) | `userId`, `workspaceId`, `status` | None | Growth experiment master record |
| `ExperimentVariant` | `id` (UUID) | `experimentId` | None | A/B test variant metrics (impressions, conversions) |
| `AIInsight` | `id` (UUID) | `projectId`, `userId`, `noteId` | None | Editor AI insight telemetry |
| `AIPRD` | `id` (UUID) | `projectId`, `userId` | None | Generated PRD record |
| `AISuggestedTask` | `id` (UUID) | `projectId`, `prdId`, `userId` | None | Suggested task records |
| `PromptLog` | `id` (UUID) | `userId`, `promptHash`, `createdAt` | None | Token usage & cost tracking log |
| `PromptCache` | `id` (UUID) | `promptHash`, `expiresAt` | `promptHash` | Groq response cache (TTL-based) |
| `APIUsage` | `id` (UUID) | `userId`, `date` | `(userId, date)` | Daily token and request aggregation |
| `Agent` | `id` (UUID) | `userId`, `key`, `workspaceId` | `(userId, key)` | Persistent autonomous agent configuration |
| `AgentRun` | `id` (UUID) | `userId`, `status`, `startedAt` | None | Autonomous mode multi-step run trace |
| `ExtensionSession` | `id` (UUID) | `userId`, `lastSeenAt` | `(userId, browserType)` | Browser extension installation state |
| `ExtensionHeartbeat` | `id` (UUID) | `userId`, `createdAt` | None | Extension ping log (7-day retention) |
| `AnalysisJob` | `id` (UUID) | `userId`, `workspaceId`, `status` | None | BullMQ queue job mirror for frontend polling |
| `Notification` | `id` (UUID) | `userId`, `read`, `createdAt` | None | In-app notification inbox |
| `ActivityLog` | `id` (UUID) | `userId`, `action`, `createdAt` | None | User audit log for compliance |
| `WebSocketConnection` | `id` (UUID) | `userId`, `connectionId`, `lastPingAt` | `connectionId` | Active WS socket connection registry |

---

## 3. Vector Database Architecture (`pgvector`)

The `SemanticEmbedding` table uses `pgvector` to store 1536-dimensional embeddings produced by OpenAI's `text-embedding-3-small` model:

```sql
-- Managed via raw SQL migration in backend/prisma/migrations
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "SemanticEmbedding" (
  "id" TEXT PRIMARY KEY,
  "entryId" TEXT UNIQUE NOT NULL REFERENCES "ProductBrainEntry"("id") ON DELETE CASCADE,
  "model" TEXT NOT NULL,
  "dims" INTEGER NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Similarity Query Execution:
Cosine distance queries are executed via raw Prisma SQL (`db.$queryRaw`):
```sql
SELECT se."entryId", (se."embedding" <=> $vectorLiteral::vector) AS distance
FROM "SemanticEmbedding" se
JOIN "ProductBrainEntry" pbe ON pbe."id" = se."entryId"
WHERE pbe."userId" = $userId
ORDER BY distance ASC
LIMIT $limit;
```

---

## 4. Relationship & Integrity Audit

### Weak / String-Based Foreign Keys:
1. **Firestore References**: `DecisionReasoning.decisionId`, `Outcome.decisionId`, `RoadmapItem.decisionId` store Firestore document string IDs without PostgreSQL referential integrity.
2. **JSON Blob Overuse**:
   - `ProductBrainEntry.metadata`, `tags`
   - `CompetitorInsight.evidence` (string[])
   - `Agent.tools`, `permissions`, `confidenceProfile`, `executionPolicy`
   - `AgentRun.steps`, `clarifications`, `decisions`, `strategy`, `roadmap`
   - `RoadmapItem.dependsOn`, `tags`
3. **Missing Scoping Indexes**:
   - Earlier versions lacked normalized `decisionId` on `ProductBrainEntry`, which was recently patched (`@@index([userId, decisionId])`) to optimize learning loop scans.
