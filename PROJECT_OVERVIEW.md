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
- **2-second debounced auto-save** to Firestore — no save button
- **Inline AI suggestions** via the `InlineSuggestion` overlay
- **Multi-document tree** in the sidebar — create, rename, delete
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
| **Score Evolution** | Tracks how a decision's confidence shifts over time as new evidence arrives |
| **Decision Health** | Classifies each decision as Healthy / Risky / Weak based on a multi-factor rubric |
| **PRD Generator** | Produces complete PRDs from notes — problem, solution, metrics, risks, timeline |
| **Task Generator** | Decomposes a PRD into a prioritized 90-day plan with dependencies |
| **Verdict Engine** | Computes PROCEED / VALIDATE_FIRST / DO_NOT_BUILD based on confidence gates |
| **Learning** | Compares expected vs. actual outcomes and feeds the delta back into future scoring |

### Autonomous Agent
- **Frontend-orchestrated multi-step reasoning agent** that runs an idea through the full product loop
- Three depth levels: **Quick** (fast, no clarifications) | **Standard** (balanced, 1 clarification) | **Deep** (thorough, 2 clarifications + confidence gate)
- State machine: Understanding → Gathering signals → Building argument → Generating verdict
- Outputs: clarifying questions, decision suggestions, strategic guidance, roadmap phases, and a final PROCEED / VALIDATE_FIRST / DO_NOT_BUILD verdict
- Runs can be saved and injected into future sessions for memory continuity

### AI Copilot Panel
- **Streaming chat** that reads the active document; 30-second timeout via `AbortController`
- **One-click shortcuts** — Generate PRD, Extract Insights, Suggest Tasks
- **Proactive signals** — surfaces repeated keywords, weak assumptions, and opportunity cues as you type

### Export
- **PRDs** — export to Markdown or Word (.docx)
- **Signals/Insights** — export to Markdown or .docx
- **Tasks** — export to CSV

### Slack Integration
- **OAuth flow** — connect a Slack workspace; tokens stored encrypted (AES-256-GCM)
- **Channel browser** — list and select channels for import
- **Message import** — pull channel history into the research loop as raw input
- **SlackView** — dedicated UI with connection status, workspace switcher, import progress

### Public Platform
- **Cases** — every published decision becomes a permanent record at `/c/{caseId}` with reasoning trace, scores, and post-launch outcome
- **Profiles** — `/u/{userId}` shows a user's published cases and rolling score average
- **Workspaces** — invite team members, manage shared decision knowledge base
- **Publish validation** — `publishCase` requires an expected outcome (metric + target + timeframe) before going public, so every case can be graded later

### Auth & Persistence
- **Google Sign-In** via Firebase Auth, with token refresh and cross-tab session sync
- **Token verification caching** on the backend (5-minute TTL) to reduce Firebase Admin SDK round-trips
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
| `/api/import/[...path]` | Next.js proxy — URL/file/Slack import to backend (auth-required) |

### Workspace Views

The sidebar organizes features into five sections:

| Section | View | Purpose |
|---|---|---|
| **Agent** | Autonomous Mode | Multi-step AI reasoning agent — idea → verdict |
| **Evidence** | Editor | Rich-text research notes, auto-saved |
| **Evidence** | Signals | Extracted insights, filterable by category |
| **Argument** | Decisions | Scored product decisions with health evaluation |
| **Verdict** | Spec (PRDs) | AI-generated product requirements documents |
| **Verdict** | Tasks | Kanban execution plan with dependency tracking |
| **Publish** | Platform / Cases | Team workspaces, public case portfolio |
| **Publish** | Slack | Connect workspace, import channel history |

---

## Technical Stack

### Frontend
- **Next.js 16** (App Router) · **React 19** · **TypeScript** (strict mode)
- **TipTap 3** headless editor framework
- **Zustand 5** state with localStorage persistence (`useAppStore`, `useActivityStore`, `useToastStore`)
- **Tailwind CSS 4** + shadcn/ui components
- **Firebase Web SDK 12** — Auth + Firestore
- **react-resizable-panels** — three-column resizable layout

### Backend (`backend/`)
- **Fastify 5** with **Pino** structured logging
- **Zod** validation on every route
- **Prisma 7 → PostgreSQL** — 9 models covering AI outputs, prompt cache (60-min TTL), per-user usage telemetry, and decision reasoning traces
- **Firebase Admin SDK** verifying ID tokens on every protected route (with 5-min verification cache)
- **Groq SDK** with prompt-cache dedup and per-call cost logging

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
| `DecisionReasoning` | Full reasoning traces for scored decisions (unique per decision) |
| `PatternAnalysis` | Real-time pattern detection results with TTL |
| `PromptLog` | Audit trail of every AI call — tokens, cost, latency |
| `PromptCache` | Hash-keyed response cache with 60-min TTL and hit counter |
| `AISuggestedTask` | Groq-generated tasks, dismissible per user |
| `APIUsage` | Daily aggregated usage per user (quota + cost monitoring) |

### Firestore — primary application data

| Collection | Contents |
|---|---|
| `users/{uid}` | User profile |
| `documents/{docId}` | Research notes (TipTap JSON) |
| `decisions/{decisionId}` | Scored product decisions |
| `insights/{insightId}` | Extracted signals |
| `prds/{prdId}` | Generated specs |
| `tasks/{taskId}` | Kanban execution tasks |
| `workspaces/{workspaceId}` | Team workspace records |
| `slackWorkspaces/{teamId}` | Slack integration state |
| `slackInstallations/{teamId}` | Encrypted bot token storage |

---

## Repository Layout

```
Speckula/
├── src/
│   ├── app/                    # Next.js App Router (layout, /, /c, /u, /api)
│   ├── components/
│   │   ├── ai/                 # AIPanel, streaming chat UI
│   │   ├── editor/             # TipTapEditor, EditorToolbar, InlineSuggestion
│   │   ├── decision/           # ScoreCard, BreakdownChart, ScoreHistoryGraph, DecisionCardV2
│   │   ├── outcome/            # OutcomeCard, LearningInsight, ScoreAdjustment
│   │   ├── platform/           # CaseViewer, PublicProfilePage, WorkspaceDashboard, RecruiterView
│   │   ├── signals/            # NodeCard and signal visualization
│   │   ├── views/              # AutonomousModeView, InsightsView, DecisionView,
│   │   │                       # PRDsView, TasksView, PlatformView, SlackView
│   │   ├── layout/             # Shell, SidebarNav, LandingPage
│   │   └── ui/                 # shadcn/ui primitives, toaster
│   ├── lib/
│   │   ├── ai/                 # actions, autonomousAgent, scoreEngine, decisionHealth,
│   │   │                       # verdict, scoreEvolution, learningEngine, comparisonEngine,
│   │   │                       # expectedOutcome, actualOutcome, priorityEngine
│   │   ├── firebase/           # AuthProvider, config, db (Firestore repository)
│   │   ├── platform/           # caseBuilder, publishCase
│   │   └── export/             # Markdown/DOCX/CSV export utilities
│   ├── store/                  # useAppStore, useActivityStore, useToastStore
│   └── hooks/
├── backend/
│   ├── src/
│   │   ├── routes/             # aiRoutes, chatRoutes, importRoutes,
│   │   │                       # slackRoutes, slackOAuthRoutes, healthRoutes
│   │   ├── services/           # groqService, firestoreContextService, jsonExtract
│   │   ├── lib/                # firebaseAdmin, firebaseAuth, db (Prisma), tokenCrypto,
│   │   │                       # slackApi, env validation
│   │   ├── app.ts              # Fastify server setup
│   │   └── scripts/
│   │       └── retentionSweeper.ts   # TTL cleanup for caches
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
│           └── 20260428172958_init/  # Full schema migration (9 tables)
├── public/                     # Static assets (favicon.svg, etc.)
├── docs/archive/               # Historical design docs
├── prd.md                      # Product requirements
├── roadmap.md                  # Phased plan
└── firestore.rules             # Firestore security rules
```

---

## Status

**Phase 1 (MVP) — complete.** The end-to-end loop works: write → signal extraction → decision scoring → PRD → tasks → publish → outcome tracking. All six intelligence engines, the Autonomous Agent, Slack integration, public profiles, and the publish flow are wired through Firestore, Groq, and the Fastify backend.

**Recent additions (April–May 2026):**
- Autonomous Mode view with multi-depth reasoning agent
- Slack OAuth integration with encrypted token storage
- Backend fully wired into UI workflows via Next.js API proxy routes
- Firebase token verification caching (5-min TTL)
- Prisma initial migration committed (`20260428172958_init`)
- Export features: PRDs to DOCX, insights to DOCX, tasks to CSV
- Toast notification system and activity bell with history
- Keyboard shortcuts

**Known gaps before production launch:**
- No CI/CD, Dockerfile, or staging environment
- Request deduplication: AI call sites lack abort signals for mid-flight cancellation on document switch
- Several views have silent `console.error` fetch failures instead of user-facing toast errors
- Auth is Google-only — no email/password fallback
- Frontend test coverage ~10% of custom components; decision sub-components untested
- Comments UI on public cases is scaffolded but lacks backend handlers

---

## Roadmap

### Phase 2 — Team Collaboration & Connectivity
- **Multiplayer** — real-time co-authoring and decision-making for product squads
- **Workflow Integrations** — bi-directional sync with Zendesk, Gong (inputs) and Linear, Jira, GitHub (execution)
- **Comments & discussion** — threaded conversation on every published case

### Phase 3 — The Autonomous Product Assistant
- **AI-driven iteration loops** — scheduled post-launch outcome checks that auto-suggest the next iteration
- **Deep synthesis at scale** — ingest thousands of feedback points and synthesize a coherent strategy
- **Data-driven impact analysis** — connect Mixpanel / Amplitude to validate whether shipped PRDs hit their target metrics

---

## Local Setup

```bash
# 1. Frontend env
cp .env.example .env.local
# fill in GROQ_API_KEY + NEXT_PUBLIC_FIREBASE_* values

# 2. Backend env
cp backend/.env.example backend/.env
# fill in GROQ_API_KEY, Firebase Admin service account, DATABASE_URL, SLACK_CLIENT_ID/SECRET

# 3. Install
npm install
cd backend && npm install && cd ..

# 4. Run
npm run dev                    # Next.js on :3000
cd backend && npm run dev      # Fastify on :3001
```

See [.env.example](.env.example) and [backend/.env.example](backend/.env.example) for the full variable lists.
