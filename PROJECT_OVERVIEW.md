# Speckula — Product Intelligence Workspace

> **The Cursor for Product Managers.** One workspace, one AI loop, from raw idea to shipped outcome.

Product work today lives in five tabs: Notion for notes, a separate doc for the PRD, Jira for tasks, a spreadsheet for scoring, and ChatGPT in a sixth tab to glue it together. Speckula collapses that stack. You write in a single editor, and the same content silently becomes structured insights, a scored decision, a PRD, a task list, and — after launch — a public case study with the actual outcome attached. The AI doesn't sit in a side window; it flows through every step.

---

## How It Works

1. **Write.** Drop notes, interview snippets, raw thinking into the TipTap editor. Auto-saved to Firestore every two seconds.
2. **Synthesize.** The Insights Engine extracts pain points, user segments, and opportunity signals from what you wrote — automatically categorized, persisted, filterable.
3. **Decide.** The Decision Engine proposes what to build next, scored on Impact / Effort / Confidence / Demand, with a written reasoning trace you can audit. Or let the Autonomous Agent run the full loop for you.
4. **Specify.** One click turns the chosen decision into a complete PRD: problem, solution, success metrics, risks, timeline.
5. **Execute.** A second click breaks the PRD into a prioritized 90-day task plan with effort estimates and dependencies.
6. **Publish.** Promote the decision to a public case at `/c/{caseId}` — the audit trail and expected outcome travel with it.
7. **Learn.** After launch, log the actual outcome. The Comparison Engine diffs expected vs. real, updates your confidence score, and surfaces a `LearningInsight` that shapes future decisions.

The whole loop runs on **Groq Llama-3.3-70B** for sub-second responses, so the friction between a half-formed thought and structured artifact is essentially zero.

---

## Capabilities

### Editor & Workspace
- **TipTap rich-text editor** with headings, lists, links, and inline formatting
- **Structured research blocks** — Problem, Context, User Pain, Insights, Assumptions — each with inline AI suggestions
- **2-second debounced auto-save** to Firestore — no save button
- **Inline AI suggestions** via the `InlineSuggestion` overlay; per-block hints dismiss independently per document
- **URL import bar** — paste any article URL to extract and load content directly into the editor
- **File drop import** — drag and drop files (including PDFs) into the editor
- **Template picker** — start from predefined note templates
- **Multi-document tree** in the sidebar — create, rename, delete, sorted by last updated
- **Three-column shell** — sidebar nav, editor, AI panel — all collapsible and resizable
- **Light & dark themes** across every surface (Burnt Orange / Warm Cream in light, Deep Charcoal in dark)
- **Keyboard shortcuts** for common actions
- **Activity bell** with notification history (`useActivityStore`)
- **Toast notifications** (success / error / info / warning) auto-dismiss after 4 seconds

### Intelligence Engines

| Engine | What it does |
|---|---|
| **Insights** | Extracts structured pain points, behaviors, segments, opportunities from raw text |
| **Decision** | Suggests what to build next, with priority, justification, and expected impact |
| **Score Engine** | Calculates 0–100 opportunity score from impact / effort / confidence / demand |
| **Score Evolution** | Tracks how a decision's confidence shifts over time as new evidence arrives |
| **Score History** | Persists a rolling 12-entry score trend per decision |
| **Score Feedback** | Updates confidence based on post-launch outcome delta |
| **Decision Health** | Classifies each decision as Healthy / Needs Validation / Risky based on a multi-factor rubric |
| **Pushback Detection** | Flags overcommitment (high priority + low confidence) with a warning |
| **PRD Generator** | Produces complete PRDs from notes — problem, solution, metrics, risks, timeline |
| **Task Generator** | Decomposes a PRD into a prioritized 90-day plan with dependencies |
| **Priority Engine** | Intelligently re-orders tasks by effort, impact, and dependency graph |
| **Verdict Engine** | Computes PROCEED / VALIDATE_FIRST / DO_NOT_BUILD based on confidence gates |
| **Case Brief** | AI-generated opportunity statement, context, recommendation, and success metrics for any decision |
| **Learning Engine** | Generates post-launch insight explaining why a decision succeeded or failed |
| **Comparison Engine** | Diffs expected vs. actual outcome records and surfaces a deviation report |

### Autonomous Agent
- **Frontend-orchestrated multi-step reasoning agent** that runs an idea through the full product loop
- **13-state machine:** `understand_idea` → `check_clarity` → `awaiting_user` → `generate_decisions` → `reflection` → `evaluate_decisions` → `validation_layer` → `confidence_gate` → `strategy_generation` → `roadmap_generation` → `output` → `stopped` / `error`
- Three depth levels: **Quick** (no clarifications, skips roadmap) | **Standard** (1 clarification, full output) | **Deep** (2 clarifications + confidence gate on high-risk decisions)
- **Reflection loop** — if uncertainty is detected mid-run, re-evaluates decisions before proceeding
- **Past-run memory** — stores recent run ideas and verdicts in Firestore; primes the next session to avoid repeating weak framings
- Outputs: clarifying questions, 3 candidate decisions, strategic guidance, 3-phase roadmap, and a final PROCEED / VALIDATE_FIRST / DO_NOT_BUILD verdict
- **Real-time event stream** — thinking, questions, decisions, strategy, roadmap, and verdict appear as they happen
- **Stop / Reset** — abort mid-run at any point or reset for a fresh analysis
- Post-run actions: save top decision, convert to Spec (PRD), create Tasks from roadmap

### AI Copilot Panel
- **Streaming chat** that reads the active document; 30-second timeout via `AbortController`
- **One-click shortcuts** — Generate PRD, Extract Insights, Suggest Tasks
- **Proactive signals** — surfaces repeated keywords, weak assumptions, and opportunity cues as you type
- Client-side 429 circuit-breaker (15 calls/day via localStorage)

### Decisions
- Filterable by: All, Strong (score ≥ 70), Risky (45–70), Recent
- Grouped by health status: Healthy / Needs Validation / Risky
- Each decision shows: score (0–100), impact / effort / confidence / demand breakdown, priority badge, strategic theme, key insights, risks, tradeoffs
- **Case brief dialog** — AI-generated opportunity statement, context, reasoning, scoring, and build / delay / validate recommendation
- **Score history graph** — rolling 12-entry trend chart
- **Expected vs. actual outcome** — record pre-launch target metric and post-launch result; triggers learning insight
- **Manual decision form** — create decisions with title, priority, justification, user story, tradeoffs, scores
- Actions: generate PRD, save, publish as public case, delete

### Export
- **PRDs** — export to Markdown or Word (.docx)
- **Signals / Insights** — export to Markdown or .docx
- **Tasks** — export to CSV

### Slack Integration
- **OAuth flow** — connect a Slack workspace; tokens stored encrypted (AES-256-GCM) in Firestore backend collections
- **Channel browser** — list and select accessible channels for import
- **Message backfill** — pull channel history into the research loop as raw input
- **Analyze channel** — extract insights from imported Slack messages
- **Slack API proxied through Next.js** — backend never needs a public-facing domain for Slack API calls
- **SlackView** — dedicated UI with connection status, workspace switcher, import progress

### Public Platform
- **Cases** — every published decision becomes a permanent record at `/c/{caseId}` with reasoning trace, scores, and post-launch outcome
- **Profiles** — `/u/{userId}` shows a user's published cases and rolling score average
- **Recruiter view** — specialized read-only layout for public profiles
- **Workspaces** — invite team members by email, manage roles (owner / editor / viewer), shared decision knowledge base
- **Publish validation** — `publishCase` requires an expected outcome (metric + target + timeframe) before going public, so every case can be graded later

### Auth & Persistence
- **Google Sign-In** via Firebase Auth, with token refresh and cross-tab session sync
- **Token verification caching** on the backend (5-minute TTL) to reduce Firebase Admin SDK round-trips
- **Base64 Firebase private key support** (`FIREBASE_PRIVATE_KEY_B64`) for Docker and Dokploy environments where multiline `.env` values are unreliable
- **First-login provisioning** auto-creates `users/{uid}` in Firestore
- **Firestore subcollections** for documents, insights, PRDs, tasks, decisions, and public cases
- **Graceful 401 recovery** — token refresh + retry on auth failure

---

## Application Surface

### Routes

| Path | Purpose |
|---|---|
| `/` | Landing page + workspace shell (auth-gated) |
| `/c/[caseId]` | Public read-only case viewer |
| `/u/[userId]` | Public user profile |
| `/api/chat` | Next.js proxy — streaming Groq chat to backend |
| `/api/ai/[...path]` | Next.js proxy — all AI endpoints to backend (auth-required) |
| `/api/import/[...path]` | Next.js proxy — URL / file / Slack import to backend (auth-required) |
| `/api/slack/[...path]` | Next.js proxy — Slack OAuth and messaging (backend needs no public domain) |

### Workspace Views

The sidebar organizes features into five sections:

| Section | View | Purpose |
|---|---|---|
| **Agent** | Autonomous Mode | Multi-step AI reasoning agent — idea → verdict, with past-run memory |
| **Evidence** | Editor | Rich-text research notes, structured blocks, auto-saved, URL import, templates |
| **Evidence** | Signals | Extracted insights, filterable by category (pain point / opportunity / segment / pattern) |
| **Argument** | Decisions | Scored product decisions with health evaluation, case briefs, score history, outcome loop |
| **Verdict** | Spec (PRDs) | AI-generated product requirements documents, export to Markdown / .docx |
| **Verdict** | Tasks | Kanban execution plan with drag-drop, dependency tracking, intelligent prioritization, CSV export |
| **Publish** | Platform / Cases | Team workspaces, public case portfolio |
| **Publish** | Slack | Connect workspace, import channel history, analyze messages |

---

## Technical Stack

### Frontend
- **Next.js 16** (App Router) · **React 19** · **TypeScript** (strict mode)
- **TipTap 3** headless editor framework with ProseMirror
- **Zustand 5** state with localStorage persistence (`useAppStore`, `useActivityStore`, `useToastStore`, `useExportDialogStore`)
- **Tailwind CSS 4** + shadcn/ui components + Base UI
- **Firebase Web SDK 12** — Auth + Firestore
- **react-resizable-panels** — three-column resizable layout
- **docx** — client-side Word document generation for exports

### Backend (`backend/`)
- **Fastify 5** with **Pino** structured logging
- **Zod 4** validation on every route
- **Prisma 7 → PostgreSQL** — 8 models covering AI outputs, prompt cache (60-min TTL), per-user usage telemetry, and decision reasoning traces
- **Firebase Admin SDK** verifying ID tokens on every protected route (with 5-min verification cache)
- **Groq SDK** (`llama-3.3-70b-versatile`) with prompt-cache dedup and per-call cost logging
- **@extractus/article-extractor** — URL content extraction for the import flow
- **pdf-parse** — PDF text extraction
- **@fastify/rate-limit** — 100 req/hr per user for `/ai/*`, 30 req/hr for `/import/*`
- **Retention sweeper** — cron-style cleanup of `PromptLog` and `DecisionReasoning` after 60 days (runs 60s after startup, then every 6 hours)

### Backend Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/ai/insights/generate` | Extract insights from content |
| POST | `/ai/prd/generate` | Generate PRD from notes / decisions |
| POST | `/ai/tasks/suggest` | Suggest tasks from a PRD |
| POST | `/ai/patterns/analyze` | Detect patterns in live text |
| POST | `/ai/decisions/score` | Score a decision with reasoning trace |
| POST | `/ai/signals/analyze` | Analyze signals from research content |
| GET  | `/ai/usage/:date` | Daily token + cost usage |
| POST | `/chat` | Streaming Groq chat with response caching |
| POST | `/import/url` | Fetch and extract article content from URL (SSRF-protected) |
| POST | `/import/slack` | Import Slack channel history |
| GET  | `/slack/workspaces` | List connected Slack workspaces |
| GET  | `/slack/channels` | List channels for a workspace |
| POST | `/slack/messages/import` | Fetch and process channel messages |
| GET  | `/slack/oauth/authorize` | Initiate Slack OAuth flow |
| GET  | `/slack/oauth/callback` | Complete OAuth, store encrypted token |
| POST | `/slack/disconnect` | Revoke Slack workspace connection |
| GET  | `/health` | Liveness probe (DB + Firebase + server status, 200/503) |

---

## Data Models

### PostgreSQL (Prisma) — AI cache, logs, and reasoning traces

| Model | Purpose |
|---|---|
| `AIInsight` | Groq-generated insights with confidence scores and TTL |
| `AIPRD` | Generated PRD documents, versioned |
| `DecisionReasoning` | Full reasoning traces for scored decisions (unique per decision, upserted on re-score) |
| `PatternAnalysis` | Real-time pattern detection results with TTL |
| `PromptLog` | Audit trail of every AI call — tokens, cost, latency. Swept after `RETENTION_DAYS` (default 60). |
| `PromptCache` | Hash-keyed response cache with 60-min TTL and hit counter |
| `AISuggestedTask` | Groq-generated tasks, dismissible per user |
| `APIUsage` | Daily aggregated usage per user (quota + cost monitoring) |

Cost reference: `llama-3.3-70b` at $0.59/M input tokens, $0.79/M output tokens. Default quota: 200K tokens/user/day (~$0.12).

### Firestore — primary application data

**User-scoped** (only the authenticated owner can read/write):

| Collection | Contents |
|---|---|
| `users/{uid}` | User profile |
| `users/{uid}/documents/{docId}` | Research notes (TipTap JSON, `lastInsightExtractionHash`) |
| `users/{uid}/insights/{id}` | Extracted signals (category, `sourceDocId`) |
| `users/{uid}/decisions/{id}` | Scored decisions (impact/effort/confidence/demand, tradeoffs, risks, `strategicTheme`) |
| `users/{uid}/decisions/{id}/outcomes/{id}` | Expected vs. actual outcome records |
| `users/{uid}/prds/{id}` | Generated specs (markdown content, status, `sourceDocId`) |
| `users/{uid}/tasks/{id}` | Kanban tasks (priority, milestone, effort, `dependsOn`, `dueDate`) |
| `users/{uid}/pastRuns/{id}` | Autonomous mode memory (idea, `topDecisions`, verdict) |
| `users/{uid}/scoreHistory/{id}` | Score progression tracking over time |

**Public data** (world-readable when visibility permits):

| Collection | Contents |
|---|---|
| `publicProfiles/{userId}` | Opt-in profiles (name, bio, skills, `published` flag) |
| `publicCases/{caseId}` | Published decisions (`visibility`: public / private / unlisted; requires `expectedOutcome`) |
| `publicCases/{caseId}/comments/{id}` | Threaded comments (scaffolded; backend handlers pending) |

**Collaboration:**

| Collection | Contents |
|---|---|
| `workspaces/{workspaceId}` | Team workspaces (ownerId, memberIds, member roles) |

**Backend-only** (Firestore security rules forbid all frontend access):

| Collection | Contents |
|---|---|
| `slackInstallations/{teamId}` | AES-256-GCM encrypted bot tokens, ownerUserId |
| `slackMessages/{docId}` | Message backfills from Slack channels |
| `slackEventDedupe/{eventId}` | Webhook delivery deduplication state |

---

## Repository Layout

```
Speckula/
├── src/
│   ├── app/                    # Next.js App Router (layout, /, /c, /u, /api)
│   ├── components/
│   │   ├── ai/                 # AIPanel, streaming chat UI
│   │   ├── editor/             # TipTapEditor, EditorToolbar, InlineSuggestion,
│   │   │                       # URLImportBar, TemplatePicker
│   │   ├── decision/           # ScoreCard, BreakdownChart, ScoreHistoryGraph,
│   │   │                       # DecisionCardV2, FocusPanel, CaseBriefDialog,
│   │   │                       # DecisionHeaderCard
│   │   ├── outcome/            # OutcomeCard, LearningInsight, ScoreAdjustment
│   │   ├── platform/           # PublicCasePage, PublicProfilePage, WorkspaceDashboard,
│   │   │                       # RecruiterView
│   │   ├── signals/            # NodeCard and signal visualization
│   │   ├── views/              # AutonomousModeView, InsightsView, DecisionView,
│   │   │                       # PRDsView, TasksView, PlatformView, SlackView
│   │   ├── layout/             # Shell, SidebarNav, LandingPage
│   │   └── ui/                 # shadcn/ui primitives, toaster
│   ├── lib/
│   │   ├── ai/                 # actions, autonomousAgent, scoreEngine, decisionHealth,
│   │   │                       # verdict, scoreEvolution, scoreFeedback, scoreHistory,
│   │   │                       # learningEngine, comparisonEngine, expectedOutcome,
│   │   │                       # actualOutcome, priorityEngine, aiContext, aiTrigger,
│   │   │                       # aiFilter, progressTracker, caseBuilder (24 files)
│   │   ├── firebase/           # AuthProvider, config, db (Firestore repository)
│   │   ├── platform/           # caseBuilder, publishCase
│   │   └── export/             # Markdown / DOCX / CSV export utilities
│   ├── store/                  # useAppStore, useActivityStore, useToastStore,
│   │                           # useExportDialogStore
│   └── hooks/                  # useKeyboardShortcuts, useFileDropImport, use-mobile
├── backend/
│   ├── src/
│   │   ├── routes/             # aiRoutes, chatRoutes, importRoutes,
│   │   │                       # slackRoutes, slackOAuthRoutes, healthRoutes
│   │   ├── services/           # groqService, firestoreContextService, jsonExtract
│   │   ├── lib/                # firebaseAdmin, firebaseAuth, db (Prisma), tokenCrypto,
│   │   │                       # slackApi, env validation
│   │   ├── app.ts              # Fastify server setup
│   │   └── scripts/
│   │       └── retentionSweeper.ts   # TTL cleanup for PromptLog / DecisionReasoning
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
│           └── 20260428172958_init/  # Full schema migration (8 tables)
├── docker-compose.yml          # Local PostgreSQL (postgres:16-alpine) + backend
├── public/                     # Static assets (favicon.svg S-mark logo)
├── docs/archive/               # Historical design docs
├── prd.md                      # Product requirements
├── roadmap.md                  # Phased plan
└── firestore.rules             # Firestore security rules
```

---

## Status

**Phase 1 (MVP) — complete.** The end-to-end loop works: write → signal extraction → decision scoring → PRD → tasks → publish → outcome tracking. All intelligence engines, the Autonomous Agent, Slack integration, public profiles, and the publish flow are wired through Firestore, Groq, and the Fastify backend.

**Additions (April–May 2026):**
- Score history tracking and outcome feedback loop (expected vs. actual → learning insight)
- Decision Health system (Healthy / Needs Validation / Risky classification) with overcommitment / pushback detection
- Case Brief AI generation (opportunity statement, context, recommendation, metrics)
- Autonomous Mode past-run memory (Firestore-persisted, primes next session)
- Reflection loop and confidence gate in the Autonomous Agent
- Task dependency declarations with reasoning and intelligent prioritization engine
- Kanban drag-drop, task categories (backend / frontend / design / QA / integration / devops)
- Export: PRDs to .docx, insights to .docx, tasks to CSV
- Toast notification system and activity bell with history
- Keyboard shortcuts
- File drop import (including PDF extraction via `pdf-parse`)
- Structured research blocks in the editor (Problem, Context, User Pain, Insights, Assumptions)
- Per-document dismissed-hint tracking for inline AI suggestions
- Slack API proxied through Next.js so backend needs no public domain
- Firebase private key base64 support (`FIREBASE_PRIVATE_KEY_B64`) for Docker environments
- Local PostgreSQL container via Docker Compose (removed Neon cloud dependency)
- Retention sweeper for PromptLog and DecisionReasoning (60-day TTL, runs every 6 hours)
- URL import bar and template picker in the editor
- Recruiter view for public profiles
- Client-side 429 circuit-breaker on AI Copilot (15 calls/day via localStorage)

**Known gaps before production launch:**
- No CI/CD pipeline or staging environment
- Request deduplication: AI call sites lack abort signals for mid-flight cancellation on document switch
- Several views have silent `console.error` fetch failures instead of user-facing toast errors
- Auth is Google-only — no email/password fallback
- Frontend test coverage ~10% of custom components; decision sub-components untested
- Comments UI on public cases is scaffolded but lacks backend handlers
- `WorkspaceDashboard` component is a skeleton — workspace collaboration UI is partial

---

## Roadmap

### Phase 2 — Team Collaboration & Connectivity
- **Multiplayer** — real-time co-authoring and decision-making for product squads
- **Workflow Integrations** — bi-directional sync with Zendesk, Gong (inputs) and Linear, Jira, GitHub (execution)
- **Comments & discussion** — threaded conversation on every published case (backend handlers)

### Phase 3 — The Autonomous Product Assistant
- **AI-driven iteration loops** — scheduled post-launch outcome checks that auto-suggest the next iteration
- **Deep synthesis at scale** — ingest thousands of feedback points and synthesize a coherent strategy
- **Data-driven impact analysis** — connect Mixpanel / Amplitude to validate whether shipped PRDs hit their target metrics

---

## Local Setup

```bash
# 1. Frontend env
cp .env.example .env.local
# fill in NEXT_PUBLIC_FIREBASE_* values

# 2. Backend env
cp backend/.env.example backend/.env
# fill in GROQ_API_KEY, Firebase Admin credentials, SLACK_* vars

# 3. Start local PostgreSQL + backend via Docker Compose
docker compose up -d
# DATABASE_URL is pre-wired to the local container (postgres:16-alpine)

# 4. Install and run frontend
npm install
npm run dev                    # Next.js on :3000

# 5. Run backend (if not using Docker for it)
cd backend && npm install && npm run dev  # Fastify on :3001
```

See [.env.example](.env.example) and [backend/.env.example](backend/.env.example) for the full variable lists.

### Environment Variables Reference

**Frontend (`.env.local`)**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web SDK |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase FCM sender |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase App ID |
| `BACKEND_URL` | Server-side only proxy target (default `http://localhost:3001`) |

**Backend (`backend/.env`)**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL pooled connection (runtime) |
| `DIRECT_DATABASE_URL` | PostgreSQL direct connection (Prisma migrations) |
| `GROQ_API_KEY` | Groq API key (must start with `gsk_`) |
| `FIREBASE_PROJECT_ID` | Firebase Admin SDK |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin SDK service account |
| `FIREBASE_PRIVATE_KEY` | PEM key with literal `\n`, OR… |
| `FIREBASE_PRIVATE_KEY_B64` | …base64-encoded PEM (preferred for Docker/Dokploy) |
| `FRONTEND_URL` / `FRONTEND_URLS` | CORS origin(s), comma-separated |
| `SLACK_CLIENT_ID` | Slack app credentials |
| `SLACK_CLIENT_SECRET` | Slack app credentials |
| `SLACK_REDIRECT_URI` | Slack OAuth callback URL |
| `SLACK_SIGNING_SECRET` | Webhook HMAC verification |
| `SLACK_TOKEN_ENCRYPTION_KEY` | 64 hex chars (32 bytes) for AES-256-GCM token encryption |
| `AI_CACHE_TTL_MINUTES` | Prompt cache TTL (default `60`) |
| `DAILY_TOKEN_QUOTA` | Per-user daily token cap (default `200000`) |
| `RETENTION_DAYS` | Days to keep PromptLog/DecisionReasoning (default `60`) |
| `PORT` | Fastify listen port (default `3001`)
