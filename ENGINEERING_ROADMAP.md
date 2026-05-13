# SPECKULA — Engineering Implementation Roadmap

**Generated:** May 13, 2026  
**Based on:** Full codebase audit + architecture review  
**Scope:** Code-level fixes → scalable production system

---

## Roadmap Legend

| Symbol | Meaning |
|--------|---------|
| 🔴 | Critical — blocks scale or causes data loss |
| 🟠 | High — degrades quality or reliability |
| 🟡 | Medium — technical debt or performance |
| 🟢 | Growth — new capability or feature |
| ✅ | Done |
| 🔧 | File(s) to change |

---

## Phase 0 — Foundation Fixes (Days 1–7)
> Fix before any new feature work. These are silent production risks.

### 0.1 🔴 Firebase Admin SDK Token Verification
**Problem:** `serverAuth.ts` calls Google's public `tokeninfo` HTTP endpoint on every request — adds 200–400ms latency and hits Google's rate limit at ~200 concurrent users.  
**Fix:** Replace with `firebase-admin` `verifyIdToken()` (uses cached Google public keys, ~1ms local verification).  
🔧 `backend/src/lib/auth.ts`  
**Effort:** 2 hours | **Impact:** -200ms p50 latency on every API call

```
[ ] Install firebase-admin if not already imported via Admin SDK
[ ] Replace tokeninfo HTTP fetch with admin.auth().verifyIdToken(token)
[ ] Test with expired token, invalid token, valid token
[ ] Deploy and verify p50 latency drop in logs
```

---

### 0.2 🔴 Redis AOF Persistence for BullMQ Durability
**Problem:** Redis configured with `allkeys-lru` eviction and no persistence. On Redis restart, all queued `AnalysisJob` entries in BullMQ are lost permanently. PostgreSQL retains stale `status: 'queued'` rows that never complete.  
**Fix:** Enable AOF persistence + switch eviction policy to `noeviction`.  
🔧 `docker-compose.yml`  
**Effort:** 30 minutes | **Impact:** Job durability across restarts

```
[ ] Update redis command: --appendonly yes --appendfsync everysec
[ ] Change maxmemory-policy from allkeys-lru to noeviction
[ ] Add redis_data volume mount
[ ] Test: restart Redis container, verify queued jobs resume
```

---

### 0.3 🔴 pgvector HNSW Index
**Problem:** `embeddingService.semanticSearch()` runs an exact cosine scan over all `SemanticEmbedding` rows. No approximate index exists. At 10K entries × 1K users = 10M comparisons per query.  
**Fix:** Add HNSW index — reduces to ~100 comparisons at 99% recall.  
🔧 New Prisma migration SQL  
**Effort:** 15 minutes | **Impact:** 100x semantic search speed

```sql
CREATE INDEX IF NOT EXISTS idx_semantic_embedding_vector
ON "SemanticEmbedding"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

```
[ ] Create migration file in backend/prisma/migrations/
[ ] Run in staging, verify EXPLAIN ANALYZE uses index
[ ] Deploy to production
```

---

### 0.4 🔴 Fix Learning Loop JSON String Scan
**Problem:** `learningService.ts` finds `ProductBrainEntry` matches via `metadata: { contains: decisionId }` — a `LIKE '%id%'` full-table scan. No index. Grows to O(n) per outcome recorded.  
**Fix:** Add normalized `decisionId` column with index to `ProductBrainEntry`.  
🔧 `backend/prisma/schema.prisma`, `backend/src/services/learningService.ts`, `backend/src/services/productBrainService.ts`  
**Effort:** 2 hours | **Impact:** Indexed lookup instead of table scan

```
[ ] Add decisionId String? to ProductBrainEntry model in schema.prisma
[ ] Add @@index([userId, decisionId])
[ ] Run prisma migrate dev
[ ] Backfill: UPDATE "ProductBrainEntry" SET "decisionId" = metadata::json->>'decisionId'
[ ] Update productBrainService.ts create() to accept + persist decisionId
[ ] Update learningService.ts matching query to use where: { decisionId }
```

---

### 0.5 🟠 Fix Circuit Breaker — Exclude Transient 5xx
**Problem:** `groqService.ts` circuit breaker opens after 5 failures. Transient Groq 5xx errors (network blips) count toward the threshold, causing all AI features to fail for 60 seconds after a brief instability.  
**Fix:** Only count non-retriable errors (401, 400, 422) toward the breaker.  
🔧 `backend/src/services/groqService.ts`  
**Effort:** 1 hour | **Impact:** AI availability improvement

```
[ ] Add isCircuitBreakerFailure() function
[ ] 5xx → return false (don't count, let retry handle it)
[ ] 429 → return false (already excluded, confirm)
[ ] 401/400/422 → return true (count these)
[ ] Test with simulated 502 from Groq — verify breaker stays closed
```

---

### 0.6 🟠 Add Sentry Error Monitoring
**Problem:** Zero observability in production. Errors are invisible unless users report them.  
**Fix:** Add Sentry to both frontend and backend with userId context.  
🔧 `backend/src/index.ts`, `src/app/layout.tsx`, new `src/instrumentation.ts`  
**Effort:** 4 hours | **Impact:** Full error visibility

```
[ ] npm install @sentry/node @sentry/nextjs in respective packages
[ ] Add SENTRY_DSN to .env and docker-compose.yml
[ ] Initialize Sentry in Fastify with userId serializer
[ ] Initialize Sentry in Next.js with session replay (10% sample)
[ ] Add Sentry.captureException in Fastify global error handler
[ ] Verify errors appear in Sentry dashboard
```

---

### 0.7 🟠 Add ErrorBoundary to All Views
**Problem:** No `<ErrorBoundary>` wrapping views. A render error in `InsightsView` crashes the entire shell.  
**Fix:** Per-view error boundaries with Sentry capture and retry.  
🔧 New `src/components/ViewErrorBoundary.tsx`, `src/components/Shell.tsx` (or layout)  
**Effort:** 2 hours | **Impact:** Crash isolation — one broken view doesn't kill the app

```
[ ] Create ViewErrorBoundary class component
[ ] Call Sentry.captureException in componentDidCatch
[ ] Wrap every view in Shell.tsx with <ViewErrorBoundary view="ViewName">
[ ] Test: throw intentional error in InsightsView, verify other views still work
```

---

## Phase 1 — Decision System (Days 8–14)
> Build the missing relational backbone for decisions.

### 1.1 🔴 Decision Shadow Table in PostgreSQL
**Problem:** `Decision` entity lives only in Firestore. PostgreSQL has `DecisionReasoning`, `Outcome`, `LearningInsight` all pointing to a Firestore string ID with no FK. Deleting a Firestore decision leaves orphaned rows forever. Cannot query "all decisions with AI score < 0.5" in SQL.  
🔧 `backend/prisma/schema.prisma`  
**Effort:** 1 day | **Impact:** Relational integrity + queryable decision analytics

```prisma
model Decision {
  id          String    @id            // Firestore document ID
  userId      String
  workspaceId String?
  title       String
  status      String    @default("draft")
  priority    String?
  aiScore     Float?
  impact      Float?
  effort      Float?
  confidence  Float?
  demand      Float?
  syncedAt    DateTime
  deletedAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  reasoning   DecisionReasoning?
  outcomes    Outcome[]
  insights    LearningInsight[]

  @@index([userId])
  @@index([userId, status])
  @@index([userId, aiScore])
}
```

```
[ ] Add Decision model to schema.prisma
[ ] Add @relation on DecisionReasoning, Outcome, LearningInsight (DEFERRABLE FK)
[ ] Run prisma migrate dev --name add_decision_shadow_table
[ ] Write backfill script: iterate Firestore users/decisions → upsert PostgreSQL
[ ] Run backfill in staging, verify row counts match
[ ] Run backfill in production during low-traffic window
```

---

### 1.2 🔴 /api/decisions Endpoint Suite
**Problem:** No PostgreSQL-backed decisions API. DashboardView reads from `experimentsData` as a proxy.  
🔧 New `backend/src/routes/decisionRoutes.ts`  
**Effort:** 1 day

```
Endpoints to implement:
[ ] GET  /decisions            — list with reasoning + latest outcome
[ ] GET  /decisions/:id        — single decision with full history
[ ] POST /decisions/sync       — upsert from Firestore write (called by frontend)
[ ] DELETE /decisions/:id      — soft delete (mirrors Firestore delete)

Response shape:
{
  id, title, status, priority, aiScore, impact, effort, confidence, demand,
  reasoning: { confidenceScore, reasoning, risks, nextSteps } | null,
  latestOutcome: { verdict, deviationPct, confidenceDelta } | null,
  learningInsightCount: number
}
```

```
[ ] Create decisionRoutes.ts
[ ] Register in server: fastify.register(decisionRoutes, { prefix: '/api/decisions' })
[ ] Add Zod validation schemas
[ ] Test all endpoints with real data
```

---

### 1.3 🟠 Wire Frontend to /api/decisions
**Problem:** DashboardView "Recent Decisions" reads from `experimentsData` (wrong). DecisionView reads entirely from Firestore with no PostgreSQL awareness.  
🔧 New `src/hooks/useDecisions.ts`, `src/components/views/DashboardView.tsx`  
**Effort:** 1 day

```
[ ] Create useDecisions() hook calling GET /api/decisions
[ ] Add POST /decisions/sync call after every Firestore decision write in DecisionView.tsx
[ ] Add DELETE /decisions/:id call after Firestore delete in DecisionView.tsx
[ ] Replace experimentsData fallback in DashboardView with useDecisions() data
[ ] Wire DecisionView to show PostgreSQL-sourced reasoning + outcome history
```

---

### 1.4 🟡 Decision Deletion Cleanup
**Problem:** When a Firestore decision is deleted, `DecisionReasoning` + `Outcome` + `LearningInsight` rows in PostgreSQL remain as orphans forever.  
🔧 `backend/src/routes/decisionRoutes.ts`  
**Effort:** 2 hours

```
[ ] DELETE /decisions/:id performs soft delete (sets deletedAt)
[ ] Add nightly cleanup job: hard-delete DecisionReasoning/Outcome/LearningInsight
    where parent Decision.deletedAt < (now - 30 days)
[ ] Add orphan detection: daily count of DecisionReasoning rows with no Decision parent
```

---

## Phase 2 — Product Brain Memory (Days 15–21)
> Replace shallow recency with true semantic institutional memory.

### 2.1 🔴 Semantic Evidence Retrieval in aiGroundingService
**Problem:** `getWorkspaceEvidence()` fetches the 6 most recent entries (`take: 6, orderBy: detectedAt desc`). The entire `embeddingService.semanticSearch()` infrastructure is never used for prompt grounding. Older relevant context is silently dropped.  
🔧 `backend/src/services/aiGroundingService.ts`  
**Effort:** 1 day | **Impact:** AI quality improvement — grounding reflects relevance, not recency

```
Algorithm to implement:
1. Receive queryContext (the decision title/description being analyzed)
2. Run embeddingService.semanticSearch(queryContext, userId, { limit: N*3 })
3. Fetch full ProductBrainEntry rows for matched IDs
4. Re-rank using: finalScore = (semanticScore × 0.7) + (recencyFactor × 0.3)
   where recencyFactor = 0.5^(ageDays / 90)  [90-day half-life]
5. Return top N entries by finalScore
6. Fallback to recency query if no embeddings exist for user
```

```
[ ] Add queryContext param to getWorkspaceEvidence()
[ ] Implement getRelevantBrainEntries() with semantic + recency scoring
[ ] Update all callers (aiRoutes.ts, learningService.ts, roadmapRoutes.ts, etc.)
[ ] A/B test: compare grounding quality with old vs new retrieval
[ ] Add logging: log top-3 evidence items used per AI call to PromptLog
```

---

### 2.2 🟠 Embedding Failure Tracking
**Problem:** When OpenAI embeddings fail, `ProductBrainEntry` saves without embeddings silently. `semanticSearch()` never returns these entries. No audit trail, no retry mechanism.  
🔧 `backend/prisma/schema.prisma`, `backend/src/services/productBrainService.ts`, `backend/src/services/embeddingService.ts`  
**Effort:** 3 hours

```
[ ] Add embeddingStatus String @default("pending") to ProductBrainEntry
    Values: pending | complete | failed | skipped
[ ] Add @@index([embeddingStatus]) for re-embedding sweep
[ ] Update embedEntry() to set status: complete on success, failed on error
[ ] Create nightly re-embedding job: find where embeddingStatus = 'failed', retry
[ ] Add metric: alert when failed count > 50 in last 24h
```

---

### 2.3 🟡 Prompt Cache Fix — Evidence-Aware Hashing
**Problem:** `hashPrompt()` includes the full prompt with injected workspace evidence. Since evidence changes on every new signal, the cache never hits for grounded prompts. Effective cache hit rate ≈ 0% for expensive endpoints.  
🔧 `backend/src/services/groqService.ts`  
**Effort:** 4 hours

```
[ ] Split prompts into: staticPart (query text) + evidencePart (grounding context)
[ ] Hash only staticPart for cache key (evidence-stable cache)
[ ] Cache evidence block separately in Redis with 5-minute TTL
[ ] Track cache hit rate per endpoint in PromptLog.metadata
[ ] Target: >30% cache hit rate for decision scoring re-runs
```

---

## Phase 3 — AI Infrastructure (Days 22–28)
> Multi-provider resilience and quality improvement.

### 3.1 🟠 Provider Abstraction Layer
**Problem:** All AI calls hard-coded to Groq. Single point of failure. Cannot route different task types to best-fit models.  
🔧 New `backend/src/services/ai/aiProvider.ts`, `backend/src/services/ai/groqProvider.ts`, `backend/src/services/ai/claudeProvider.ts`  
**Effort:** 2 days

```typescript
// Interface to implement
interface AIProvider {
  call(prompt: string, opts: AICallOptions): Promise<AIResponse>
  stream(prompt: string, opts: AICallOptions): AsyncGenerator<string>
}

// Task routing table
const TASK_ROUTING: Record<AITask, AIProvider> = {
  pattern_analysis:    groqFast,       // llama-3.1-8b-instant
  signal_extraction:   groqFast,       // llama-3.1-8b-instant
  task_suggestion:     groqFast,       // llama-3.1-8b-instant
  decision_scoring:    claudeSonnet,   // Upgrade from Groq 70B
  prd_generation:      claudeSonnet,   // Structured long-form
  learning_insight:    claudeSonnet,   // Causal reasoning
  roadmap_generation:  claudeSonnet,   // Strategic reasoning
}
```

```
[ ] Create AIProvider interface
[ ] Refactor groqService into GroqProvider implementing AIProvider
[ ] Create ClaudeProvider wrapping @anthropic-ai/sdk
[ ] Create aiRouter.ts with TASK_ROUTING map
[ ] Update all callers to use routeAI(task, prompt, opts)
[ ] Add ANTHROPIC_API_KEY to .env and docker-compose.yml
[ ] Test: verify decision scoring quality improvement vs Groq 70B
```

---

### 3.2 🟡 AI Quality Scoring System
**Problem:** No way to measure whether AI output quality is improving or degrading over time. `calibrationError` field exists on `DecisionRecord` but is never analyzed.  
🔧 New `backend/src/routes/aiRoutes.ts` (add endpoint), `backend/src/services/groqService.ts`  
**Effort:** 1 day

```
Metrics to track per prompt type:
- Average confidence score
- calibrationError (|predicted - actual| from outcome data)
- User acceptance rate (did user keep the AI output or discard it)
- Token cost per accepted output

[ ] Add promptFeedback field to PromptLog: accepted | rejected | ignored
[ ] Add POST /ai/feedback endpoint: { promptLogId, action: accepted|rejected }
[ ] Wire "Use this" / "Discard" buttons in AI panel to feedback endpoint
[ ] Add GET /ai/internal/quality endpoint: aggregate calibration + acceptance rates
[ ] Set alert: if calibrationError > 0.3 for decision_scoring task over 7 days → notify
```

---

## Phase 4 — Real Agent Infrastructure (Days 29–37)
> Replace synthetic agent personas with real schedulable autonomous jobs.

### 4.1 🟠 Rename AgentsView (Immediate — 2 hours)
**Problem:** "AI Agents" view shows fake autonomous agent personas. Users who look closely see the same job IDs. This destroys trust.  
🔧 `src/components/views/AgentsView.tsx`  
**Effort:** 2 hours

```
[ ] Rename view title: "AI Agents" → "Analysis Activity"
[ ] Remove hardcoded AGENT_CONFIG personas from display logic
[ ] Show real job history with accurate status, timestamps, source URLs
[ ] Remove fake "uptime", "tasks completed" counters derived from synthetic data
[ ] Update sidebar navigation label
[ ] DataSourceBadge: show "Live data" only when real jobs exist
```

---

### 4.2 🟢 AgentSchedule Model + Scheduler Service
**Problem:** No way to schedule recurring autonomous analysis. Every job is user-triggered.  
🔧 `backend/prisma/schema.prisma`, New `backend/src/workers/scheduler.ts`, New `backend/src/routes/agentScheduleRoutes.ts`  
**Effort:** 5 days

```prisma
model AgentSchedule {
  id          String    @id @default(uuid())
  userId      String
  workspaceId String?
  agentType   String    // market_scanner | competitor_watcher | digest_generator
  cronExpr    String    // '0 * * * *' | '*/15 * * * *'
  enabled     Boolean   @default(true)
  config      String?   // JSON: { sources, keywords, competitors, limit }
  lastRunAt   DateTime?
  nextRunAt   DateTime?
  createdAt   DateTime  @default(now())

  @@unique([userId, agentType])
  @@index([enabled, nextRunAt])
}
```

```
[ ] Add AgentSchedule to schema.prisma + run migration
[ ] Create scheduler.ts: CronJob every minute, sweeps due AgentSchedule rows
[ ] Add scheduler to worker service startup
[ ] Create agentScheduleRoutes.ts:
    POST   /agents/schedule        — Create/enable an agent type
    PATCH  /agents/schedule/:id    — Update cron/config/enabled
    GET    /agents/schedule        — List user's agents with next run
[ ] Update AgentsView UI to show real AgentSchedule rows
[ ] Test: enable market_scanner, verify job created in BullMQ after cron fires
```

---

### 4.3 🟢 Per-Agent Worker Handlers
**Problem:** Worker processes generic `AnalysisJob` but has no agent-type-specific logic.  
🔧 `backend/src/workers/`, New handler files per agent type  
**Effort:** 3 days

```
Handlers to implement:
[ ] MarketScannerHandler: crawl configured sources, save MarketSignals
[ ] CompetitorWatcherHandler: re-fetch competitor domains, diff against stored insights
[ ] DigestGeneratorHandler: aggregate weekly signals → generate summary → notify

Each handler:
- Creates AnalysisJob row on start
- Updates progress in real-time (0% → 100%)
- Saves results to ProductBrainEntry
- Publishes WebSocket event on completion
- Records to WorkspaceActivity
```

---

## Phase 5 — Frontend Re-Architecture (Days 38–49)

### 5.1 🟠 Migrate to React Query
**Problem:** 8+ independent `setInterval` polling loops — one per domain hook. Duplicate network requests, excessive re-renders, no request deduplication.  
🔧 All files in `src/hooks/`  
**Effort:** 3 days

```
[ ] npm install @tanstack/react-query
[ ] Add QueryClient + QueryClientProvider in src/app/layout.tsx
[ ] Migrate hooks in priority order:
    1. useDashboard.ts      (30s interval — highest frequency)
    2. useMarketSignals.ts  (60s interval)
    3. useAgents.ts         (30s interval)
    4. useCompetitors.ts    (60s interval)
    5. useExperiments.ts    (60s interval)
    6. useProductBrain.ts   (120s interval)
[ ] Keep useApi.ts as a low-level primitive for non-React-Query usage
[ ] Update WebSocket handler: call queryClient.invalidateQueries() on relevant events
    instead of triggering manual refetch via useSpecklaBus + useEffect
[ ] Verify: no duplicate network requests in DevTools Network tab
```

---

### 5.2 🟡 Zustand Store Separation
**Problem:** `useAppStore` is a God Object with 20+ fields spanning UI prefs, doc state, decision flow, outcome loop.  
🔧 `src/store/`  
**Effort:** 2 days

```
[ ] Create src/store/useNavigationStore.ts (persisted: activeView, aiPanelOpen, dismissedHints)
[ ] Create src/store/useDocumentStore.ts (ephemeral: currentDocId, documents, isSaving)
[ ] Create src/store/useDecisionStore.ts (ephemeral: pendingDecisionForPRD, outcomeLoop)
[ ] Create src/store/useAIStore.ts (ephemeral: selectedPRDForTasks, strategicContext)
[ ] Add compatibility shim: useAppStore() proxies to new stores (zero breaking changes)
[ ] Migrate components one by one to import from specific stores
[ ] Remove shim after all components migrated
```

---

### 5.3 🟡 Onboarding Flow
**Problem:** New users land in a fully loaded workspace with no guidance. No guided activation = no retention.  
🔧 New `src/components/onboarding/`, `src/app/onboarding/page.tsx`  
**Effort:** 3 days

```
5-step activation flow:
Step 1: Install Extension
  - Show Chrome Web Store link
  - Poll for extension heartbeat (ExtensionSession table)
  - Auto-advance when heartbeat detected

Step 2: Browse a Competitor Page
  - Prompt: "Go to notion.so, linear.app, or any competitor"
  - Poll for first ProductBrainEntry of type competitor_insight
  - Auto-advance when captured

Step 3: Make Your First Decision
  - Inline form: title + justification + priority
  - On save: show AI score animation
  - Auto-advance after score received

Step 4: Set Your Goal
  - Record expected outcome for the decision
  - expectedMetric + expectedValue + timeframe
  - Auto-advance after form submit

Step 5: Product Brain Active
  - Show ProductBrain with captured entry
  - "Your brain is building" animation
  - CTA: "Start exploring" → navigate to Dashboard

[ ] Build OnboardingShell layout
[ ] Build 5 step components
[ ] Track completion in Firestore user profile
[ ] Skip onboarding if user has existing decisions/signals
[ ] Add progress persistence (resume from last completed step)
```

---

## Phase 6 — Production Infrastructure (Days 50–60)

### 6.1 🟠 Database Connection Pooling (PgBouncer)
**Problem:** Without connection pooling, PostgreSQL receives one connection per Prisma client instance. At 100 users × 3 concurrent requests = 300+ connections. PostgreSQL default limit is 100.  
🔧 `docker-compose.yml`  
**Effort:** 4 hours

```yaml
pgbouncer:
  image: pgbouncer/pgbouncer:1.21
  environment:
    DATABASES_HOST: db
    DATABASES_PORT: 5432
    PGBOUNCER_POOL_MODE: transaction
    PGBOUNCER_MAX_CLIENT_CONN: 1000
    PGBOUNCER_DEFAULT_POOL_SIZE: 25
```

```
[ ] Add pgbouncer service to docker-compose.yml
[ ] Update DATABASE_URL to point to pgbouncer:5432
[ ] Test connection pool exhaustion with k6 load test (100 concurrent users)
[ ] Verify no "too many connections" errors in PostgreSQL logs
```

---

### 6.2 🟠 Structured Logging
**Problem:** No centralized log aggregation. Errors visible only on server console.  
🔧 `backend/src/index.ts`  
**Effort:** 2 hours

```
[ ] Enable Fastify Pino JSON logger (already available, needs configuration)
[ ] Add userId to every request log via serializer
[ ] Add AI call duration + token cost to every Groq log line
[ ] Configure log shipping: stdout → Loki / Datadog / CloudWatch (choose one)
[ ] Set LOG_LEVEL=warn in production (reduce volume)
```

---

### 6.3 🟡 Worker Concurrency + Per-User Rate Limiting
**Problem:** Worker concurrency is global (5 concurrent jobs). No per-user limit — one power user can flood the queue and starve others.  
🔧 `backend/src/workers/analysisWorker.ts`, `docker-compose.yml`  
**Effort:** 3 hours

```
[ ] Add BullMQ rate limiter: max 2 concurrent jobs per userId
[ ] Add global concurrency limit to worker: ANALYSIS_WORKER_CONCURRENCY env var
[ ] Add job priority: premium users get higher queue priority
[ ] Alert when queue depth > 50 for more than 5 minutes
```

---

## Phase 7 — Growth Features (Days 61–90)

### 7.1 🟢 Chrome Web Store Distribution
```
[ ] Finalize Plasmo extension build for production
[ ] Create Chrome Web Store developer account
[ ] Write store listing: screenshots, description, privacy policy
[ ] Submit for review (allow 1–2 weeks for Google review)
[ ] Add Firefox support (Plasmo supports it with minimal changes)
[ ] Track installs via ExtensionSession table
```

---

### 7.2 🟢 Global Search
```
Hybrid search: PostgreSQL full-text + semantic

[ ] Add full-text search index to ProductBrainEntry, Decision, MarketSignal
[ ] Create GET /search?q= endpoint combining:
    - PostgreSQL full-text (ts_vector) for exact keyword matches
    - embeddingService.semanticSearch() for concept matches
    - Merge results: deduplicate, rank by combined score
[ ] Add search UI: Cmd+K command palette
[ ] Show results grouped by type: Decisions, Signals, Competitors, Brain Entries
```

---

### 7.3 🟢 Stripe Billing
```
[ ] Create Stripe account + products:
    Free:  1 user, 50 AI calls/month, 1 workspace
    Pro:   $49/month, unlimited AI calls, 3 workspaces
    Team:  $99/month, 5 users, unlimited workspaces

[ ] Add subscription table to Prisma
[ ] Add POST /billing/checkout → Stripe checkout session
[ ] Add POST /billing/webhook → handle subscription events
[ ] Replace DAILY_TOKEN_QUOTA with plan-based limits
[ ] Add billing portal link in SettingsView
[ ] Gate: show upgrade prompt when free limit reached
```

---

### 7.4 🟢 Linear Integration
```
[ ] Create Linear OAuth app (linear.app/settings/api)
[ ] Add LinearOAuth table to Prisma (access_token, workspace_id)
[ ] Add POST /integrations/linear/connect → OAuth flow
[ ] Add POST /decisions/:id/push-to-linear → create Linear issue from Decision
[ ] Sync Decision status when Linear issue status changes (webhook)
[ ] Show "Pushed to Linear" badge on DecisionView cards
```

---

### 7.5 🟢 Real-Time Multiplayer (TipTap)
```
[ ] Evaluate: Liveblocks vs PartyKit vs self-hosted Hocuspocus
[ ] Add Yjs document provider to TipTap editor
[ ] Wire WorkspaceMember presence (show avatars of who's viewing)
[ ] Add conflict resolution: last-write-wins for non-overlapping ranges
[ ] Test: 5 concurrent editors on same document
```

---

### 7.6 🟢 Email Notifications
```
[ ] Add Resend (or Postmark) to backend dependencies
[ ] Email trigger points:
    - Learning insight generated for a decision
    - Weekly digest (every Monday 9am per timezone)
    - Competitor pricing change detected
    - Experiment reaches significance threshold
[ ] Add email preferences to user profile
[ ] Unsubscribe link in every email (CAN-SPAM compliance)
```

---

## Scalability Milestones

### 1K Users — Target: Phase 0 + Phase 1 complete

| Metric | Current Risk | After Fixes |
|--------|-------------|-------------|
| Auth latency | 200-400ms (tokeninfo) | ~1ms (Admin SDK) |
| Job durability | Lost on Redis restart | AOF persistent |
| Semantic search | O(n) full scan | O(log n) HNSW |
| Decision integrity | Orphaned rows | FK + soft deletes |
| Error visibility | Zero | Sentry live |

---

### 10K Users — Target: Phase 0–3 complete

| Component | Risk | Fix |
|-----------|------|-----|
| PostgreSQL connections | Exhausted at 100+ | PgBouncer (Phase 6.1) |
| Groq rate limits | Hit at ~5K calls/day | Claude Sonnet routing (Phase 3.1) |
| Worker throughput | Single container | Scale to 3–5 replicas |
| Cache hit rate | ~0% for grounded prompts | Evidence-stable hash (Phase 2.3) |

---

### 100K Users — Target: Post-roadmap architecture work

```
Required architectural changes (not in this roadmap):
- PostgreSQL read replica for analytics queries
- Sharded job queues (by userId % N workers)
- Self-hosted embedding model (reduce OpenAI dependency)
- Firestore → PostgreSQL migration or full CQRS event sourcing
- Cloudflare CDN for Next.js static assets
- Enterprise SSO (WorkOS SAML/OIDC)
```

---

## 30-Day Sprint Summary

| Days | Phase | Key Deliverables |
|------|-------|-----------------|
| 1–7 | Phase 0 | Firebase Admin SDK, Redis AOF, pgvector index, circuit breaker fix, Sentry, ErrorBoundary |
| 8–14 | Phase 1 | Decision shadow table, backfill, /api/decisions, Dashboard wired to real data |
| 15–21 | Phase 2 | Semantic evidence retrieval, embedding failure tracking, prompt cache fix |
| 22–28 | Phase 3 | AI provider abstraction, Claude Sonnet routing, quality scoring |
| 29–37 | Phase 4 | Rename Agents view, AgentSchedule model, scheduler service |
| 38–49 | Phase 5 | React Query migration, Zustand separation, onboarding flow |
| 50–60 | Phase 6 | PgBouncer, structured logging, worker rate limiting |
| 61–90 | Phase 7 | Chrome Web Store, Global Search, Stripe, Linear, Multiplayer |

---

## Files Changed Summary

| File | Change |
|------|--------|
| `backend/src/lib/auth.ts` | Firebase Admin SDK verifyIdToken |
| `docker-compose.yml` | Redis AOF, PgBouncer service |
| `backend/prisma/schema.prisma` | Decision, AgentSchedule, embeddingStatus, decisionId index |
| `backend/src/services/aiGroundingService.ts` | Semantic evidence retrieval |
| `backend/src/services/groqService.ts` | Circuit breaker fix, cache hash fix |
| `backend/src/services/learningService.ts` | Indexed decisionId lookup |
| `backend/src/services/productBrainService.ts` | embeddingStatus tracking |
| `backend/src/services/ai/aiProvider.ts` | NEW: Provider abstraction |
| `backend/src/services/ai/claudeProvider.ts` | NEW: Claude Sonnet integration |
| `backend/src/routes/decisionRoutes.ts` | NEW: /api/decisions CRUD |
| `backend/src/routes/agentScheduleRoutes.ts` | NEW: /api/agents/schedule |
| `backend/src/workers/scheduler.ts` | NEW: Cron scheduler service |
| `backend/src/index.ts` | Sentry init, Pino JSON logging |
| `src/store/useNavigationStore.ts` | NEW: Extracted from useAppStore |
| `src/store/useDocumentStore.ts` | NEW: Extracted from useAppStore |
| `src/store/useDecisionStore.ts` | NEW: Extracted from useAppStore |
| `src/hooks/useDecisions.ts` | NEW: React Query decisions hook |
| `src/hooks/useMarketSignals.ts` | React Query migration |
| `src/hooks/useDashboard.ts` | React Query migration |
| `src/components/views/AgentsView.tsx` | Rename to Analysis Activity |
| `src/components/views/DashboardView.tsx` | Wire to /api/decisions |
| `src/components/ViewErrorBoundary.tsx` | NEW: Per-view error boundary |
| `src/components/onboarding/` | NEW: 5-step onboarding flow |
| `src/app/layout.tsx` | Sentry init, QueryClientProvider |

---

*This roadmap reflects the state of the codebase as of May 13, 2026. Re-evaluate phase boundaries after Phase 1 completion.*
