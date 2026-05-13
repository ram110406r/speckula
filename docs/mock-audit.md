# Mock Data Audit Manifest

**Phase 1 — BUILDCASE Migration Playbook**
**Date:** 2026-05-13
**Status:** Complete — all remaining mock sources catalogued

---

## Summary

| View | Mock Variables | Domain | Backend Exists | Hook Exists | Complexity |
|------|---------------|--------|----------------|-------------|------------|
| WorkspaceView | RECENT_INTELLIGENCE, TEAM_ACTIVITY, PHASE_HEALTH, stat literals | workspace / signals | Partial | No | High |
| DashboardView | MOCK_ANALYSES, MOCK_MARKET_SIGNALS, MOCK_DECISIONS, MOCK_COMPETITORS, MOCK_METRICS.activeAgents | signals / decisions / competitors | Yes | Partial (`useDashboard`) | Medium |
| AgentsView | AGENTS, EXECUTION_LOG | agents / jobs | Yes | Partial (`useAgents`, `useAgentJobs`) | Medium |
| CompetitorsView | COMPETITORS, RECENT_ALERTS, MATRIX_ROWS | competitors | Yes | Partial (`useCompetitors`, `useCompetitorChanges`) | Medium |
| ExperimentsView | EXPERIMENTS, LEARNINGS | experiments | Yes (routes + Prisma) | None | High |
| ProductBrainView | MEMORIES, hardcoded metrics | product brain | Yes (routes + Prisma) | None | High |

---

## Already Migrated (Phase 0 — Pre-Playbook)

These sources were replaced with real data before the playbook began:

| File | What Was Replaced | Replacement |
|------|-------------------|-------------|
| `src/components/views/RoadmapsView.tsx` | `ROADMAP_ITEMS` (8 items), `AI_RECOMMENDATIONS` (3), `QUARTERS` static array | `useApi('/api/roadmaps')` → Fastify `RoadmapItem` Prisma records |
| `src/components/views/SlackView.tsx` | `INTEGRATIONS` (8 with fake status/lastSync), `ACTIVITY_LOG` (5 entries) | Firestore `subscribeToIntegrationConnections` + `useApi('/api/workspaces/:id/activity')` |
| `src/app/api/extension/user/context/route.ts` | Static `rateLimitStatus` stub (all zeros) | Proxy call to `GET /extension/rate-limits` backend |
| `backend/src/routes/extensionRoutes.ts` | (none — added new endpoint) | `GET /extension/rate-limits` — real `AnalysisJob.count()` queries |

---

## Remaining Mock Sources

### 1. WorkspaceView

**File:** `src/components/views/WorkspaceView.tsx`
**Priority:** High (user-facing workspace overview)

| Variable | Line(s) | Domain | Description |
|----------|---------|--------|-------------|
| `RECENT_INTELLIGENCE` | ~40-90 | signals | 4 hardcoded `MarketSignal`-shaped items (fake titles, scores, timestamps) |
| `TEAM_ACTIVITY` | ~95-125 | workspace | 4 fake team members (Sarah K., James R., Priya M., Alex T.) with fake task counts |
| `PHASE_HEALTH` | ~130-150 | workspace | Hardcoded counts (12/8/3/24) and percentages (85/70/60/40%) for phase progress |
| Stat literals | ~131-133 | workspace | `value={12}` (signals), `value={8}` (decisions), `value="18/24"` (specs) hardcoded in JSX |

**Replacement Strategy:**
- `RECENT_INTELLIGENCE` → `useApi('/api/workspaces/:id/signals?limit=4')` (PostgreSQL `MarketSignal` records)
- `TEAM_ACTIVITY` → `useApi('/api/workspaces/:id/members')` (PostgreSQL `WorkspaceMember` join)
- `PHASE_HEALTH` / stat literals → `useApi('/api/workspaces/:id/overview')` (aggregate counts from Prisma)
- Check if `workspaceRoutes.ts` already has `/overview` or `/members` endpoints; add if missing

**Backend Gap:** Likely needs `/workspaces/:id/overview` aggregate endpoint.
**Complexity:** High

---

### 2. DashboardView

**File:** `src/components/views/DashboardView.tsx`
**Priority:** High (primary landing view)
**Note:** `useDashboard()` hook already exists and feeds `overview.recentActivity`. Several arrays only render when `overview` is null.

| Variable | Line(s) | Domain | Description |
|----------|---------|--------|-------------|
| `MOCK_FEED_ITEMS` | ~20-80 | signals | 10 fake activity feed entries — used as fallback when `overview.recentActivity` is empty |
| `MOCK_ANALYSES` | ~85-110 | analysis | 3 hardcoded analysis results — no real source wired |
| `MOCK_MARKET_SIGNALS` | ~115-155 | signals | 5 fake signals with scores/categories — no real source wired |
| `MOCK_DECISIONS` | ~160-195 | decisions | 3 fake decisions with scores 87/91/74 — no real source wired |
| `MOCK_COMPETITORS` | ~200-230 | competitors | 5 fake competitor summaries — no real source wired |
| `MOCK_METRICS.activeAgents` | ~235 | agents | Hardcoded `activeAgents: 3` — comment says "no real source yet" |

**Replacement Strategy:**
- `MOCK_FEED_ITEMS` → already partially replaced; make `overview.recentActivity` the sole source, remove fallback
- `MOCK_ANALYSES` → `useApi('/api/extension/jobs?limit=3')` (recent `AnalysisJob` records)
- `MOCK_MARKET_SIGNALS` → `useApi('/api/workspaces/:id/signals?limit=5')` (PostgreSQL `MarketSignal`)
- `MOCK_DECISIONS` → `useApi('/api/workspaces/:id/decisions?limit=3')` or Firestore `decisions` sub-collection
- `MOCK_COMPETITORS` → `useCompetitors()` hook already exists; remove fallback once hook returns data
- `MOCK_METRICS.activeAgents` → count from `useAgents()` hook's running agents

**Backend Gap:** Signals and decisions endpoints may need workspace-scoped variants.
**Complexity:** Medium

---

### 3. AgentsView

**File:** `src/components/views/AgentsView.tsx`
**Priority:** Medium
**Note:** `useAgents()` + `useAgentJobs()` hooks exist. `hasRealAgents` flag gates display — when true, real data renders; when false, `AGENTS` mock renders.

| Variable | Line(s) | Domain | Description |
|----------|---------|--------|-------------|
| `AGENTS` | ~10-90 | agents | 6 fake agents with names, types, `tasksCompleted` (1247/892/234/67/34/12), fake `lastRun` timestamps |
| `EXECUTION_LOG` | ~95-145 | jobs | 6 fake execution log entries with fake durations and status |

**Replacement Strategy:**
- `AGENTS` fallback → Remove `hasRealAgents` guard; always render from `useAgents()` hook; show empty state when array is empty
- `EXECUTION_LOG` → `useAgentJobs()` hook already fetches recent jobs; wire to execution log display, remove mock fallback
- Add `DataSourceBadge` already present in this view to clearly show live vs. demo

**Backend Gap:** None — `agentRoutes.ts` + `AgentRun` Prisma model already supports this.
**Complexity:** Medium (primarily frontend wiring + guard removal)

---

### 4. CompetitorsView

**File:** `src/components/views/CompetitorsView.tsx`
**Priority:** Medium
**Note:** `useCompetitors()` + `useCompetitorChanges()` hooks exist. `hasRealData` / `hasRealChanges` flags gate display.

| Variable | Line(s) | Domain | Description |
|----------|---------|--------|-------------|
| `COMPETITORS` | ~15-120 | competitors | 5 fake competitors with full fake pricing, changelogs, weaknesses, complaints, features, scores |
| `RECENT_ALERTS` | ~125-165 | competitors | 5 fake change alerts with fake severity/timestamps |
| `MATRIX_ROWS` | ~170-210 | competitors | Hardcoded feature-comparison matrix rows |

**Replacement Strategy:**
- `COMPETITORS` fallback → Remove `hasRealData` guard; render from `useCompetitors()`; show empty state
- `RECENT_ALERTS` → `useCompetitorChanges()` hook data; remove `hasRealChanges` guard
- `MATRIX_ROWS` → Derive dynamically from `useCompetitors()` features array; or keep static if feature names are product config rather than data

**Backend Gap:** None — `competitorRoutes.ts` + `CompetitorInsight` Prisma model already supports this.
**Complexity:** Medium

---

### 5. ExperimentsView

**File:** `src/components/views/ExperimentsView.tsx`
**Priority:** High (no real hook exists at all)

| Variable | Line(s) | Domain | Description |
|----------|---------|--------|-------------|
| `EXPERIMENTS` | ~10-120 | experiments | 5 fake experiments with fake statistical results: confidence 89/94/97/72, n=234/1247/892/156 |
| `LEARNINGS` | ~125-165 | experiments | 3 hardcoded experiment learnings/insights |

**Replacement Strategy:**
- Create `src/hooks/useExperiments.ts` — `useApi('/api/experiments')` with workspace scoping
- Create `src/app/api/experiments/[[...path]]/route.ts` — proxy to Fastify backend
- Verify `backend/src/routes/experimentRoutes.ts` returns `Experiment` + `ExperimentVariant` records
- Map backend `Experiment` shape → frontend display type (variants as confidence/n values)
- `LEARNINGS` → Add `learnings` array to `Experiment` Prisma model or derive from completed experiment notes
- Add loading, error, empty states

**Backend Gap:** Need to verify `experimentRoutes.ts` is registered in Fastify and proxy route exists.
**Complexity:** High (hook + proxy + type mapping + possible Prisma schema addition for learnings)

---

### 6. ProductBrainView

**File:** `src/components/views/ProductBrainView.tsx`
**Priority:** High (no real hook exists at all)

| Variable | Line(s) | Domain | Description |
|----------|---------|--------|-------------|
| `MEMORIES` | ~10-100 | product brain | 8 fake entries with confidence scores 94/91/67/... and fake categories/sources |
| Hardcoded metrics | ~105 | product brain | `"847 memories"` literal, possibly other stat literals |

**Replacement Strategy:**
- Create `src/hooks/useProductBrain.ts` — `useApi('/api/product-brain')` with workspace scoping + search/filter params
- Create `src/app/api/product-brain/[[...path]]/route.ts` — proxy to Fastify backend
- Verify `backend/src/routes/productBrainRoutes.ts` returns `ProductBrainEntry` records
- Map backend `ProductBrainEntry` shape → frontend `Memory` display type (confidence as 0-1 float → 0-100 display)
- Hardcoded count → derive from `data.length` or total count field from API response
- Add loading, error, empty states

**Backend Gap:** Need to verify `productBrainRoutes.ts` is registered in Fastify and proxy route exists.
**Complexity:** High (hook + proxy + type mapping)

---

## Phase Completion Checklist

- [x] All remaining mock sources identified
- [x] Files verified by direct source read
- [x] Replacement strategy defined for each source
- [x] Backend gap analysis complete
- [x] Complexity estimates assigned
- [x] Phase 2: Backend API Gaps resolved — experiments proxy created (`src/app/api/experiments/[[...path]]/route.ts`); product-brain proxy already existed; workspace dashboard endpoint already existed
- [x] Phase 3a: WorkspaceView — all mock arrays replaced with `useApi` workspace dashboard + activity endpoints
- [x] Phase 3b: ExperimentsView — complete rewrite using `useApi('/api/experiments')` + real `handleToggle` calling `PATCH /api/experiments/:id/status`
- [x] Phase 3c: ProductBrainView — complete rewrite using `useProductBrain` hook; `AddMemoryForm` calls real `POST /api/product-brain/entries`; all metrics derived from real data
- [x] Phase 3d: DashboardView — MOCK_ANALYSES, MOCK_MARKET_SIGNALS, MOCK_COMPETITORS replaced with `useAgentJobs`, `useMarketSignals`, `useCompetitors`; `activeAgents` now from `useAgents().data.summary.running`
- [x] Phase 3e: AgentsView — already wired with `useAgents`/`useAgentJobs`; guards retain mock as fallback until backend confirms real agent types
- [x] Phase 3f: CompetitorsView — already wired with `useCompetitors`/`useCompetitorChanges`; fixed `trackedCount` double-count; guards retain mock as reference data
- [ ] Phase 5: Groq grounding (AI calls use DB evidence, not in-memory fixtures)
- [x] Phase 6: Cleanup — `MOCK_FEED_ITEMS` removed; unused icon imports (`Globe`, `MessageSquare`, `FlaskConical`) dropped; feed falls back to `[]` (honest empty state); final `tsc --noEmit` passes clean on both frontend and backend

---

## Backend Route Registration Checklist

Routes to verify are registered in `backend/src/server.ts` or equivalent entry point:

| Route File | Prefix | Verified |
|-----------|--------|---------|
| `extensionRoutes.ts` | `/extension` | Yes (rate-limits added this session) |
| `roadmapRoutes.ts` | `/roadmaps` | Yes (proxy created this session) |
| `workspaceRoutes.ts` | `/workspaces` | Yes |
| `agentRoutes.ts` | `/agents` | Yes (verified in app.ts) |
| `competitorRoutes.ts` | `/competitors` | Yes (verified in app.ts) |
| `experimentRoutes.ts` | `/experiments` | Yes (verified in app.ts) |
| `productBrainRoutes.ts` | `/product-brain` | Yes (verified in app.ts) |

---

## TypeScript Invariants

Per playbook principle P2, each phase must pass `tsc --noEmit` before proceeding.

Last clean check: End of pre-playbook Phase 0 (RoadmapsView + SlackView + extension rate-limits).
Next check required: After Phase 2 backend gap resolution.
