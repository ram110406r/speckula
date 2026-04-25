# Buildcase — Product Intelligence Workspace

> **The Cursor for Product Managers.** One workspace, one AI loop, from raw idea to shipped outcome.

Product work today lives in five tabs: Notion for notes, a separate doc for the PRD, Jira for tasks, a spreadsheet for scoring, and ChatGPT in a sixth tab to glue it together. Buildcase collapses that stack. You write in a single editor, and the same content silently becomes structured insights, a scored decision, a PRD, a task list, and — after launch — a public case study with the actual outcome attached. The AI doesn't sit in a side window; it flows through every step.

---

## 🚀 How It Works

1. **Write.** Drop notes, interview snippets, raw thinking into the TipTap editor. Auto-saved to Firestore every two seconds.
2. **Synthesize.** The Insights Engine extracts pain points, user segments, and opportunity signals from what you wrote — automatically categorized, persisted, filterable.
3. **Decide.** The Decision Engine proposes what to build next, scored on Impact / Effort / Confidence / Demand, with a written reasoning trace you can audit.
4. **Specify.** One click turns the chosen decision into a complete PRD: problem, solution, success metrics, risks, timeline.
5. **Execute.** A second click breaks the PRD into a prioritized 90-day task plan with effort estimates and dependencies.
6. **Publish.** Promote the decision to a public **case** at `/c/{caseId}` — the audit trail and expected outcome travel with it.
7. **Learn.** After launch, log the actual outcome. The Comparison Engine diffs expected vs. real, updates your confidence score, and surfaces a `LearningInsight` that shapes future decisions.

The whole loop runs on **Groq Llama-3.3-70B** for sub-second responses, so the friction between a half-formed thought and structured artifact is essentially zero.

---

## ✨ Capabilities

### Editor & Workspace
- **TipTap rich-text editor** with headings, lists, links, and inline formatting
- **2-second debounced auto-save** to Firestore — no save button
- **Inline AI suggestions** via the `InlineSuggestion` overlay
- **Multi-document tree** in the sidebar — create, rename, delete
- **Three-column shell** — sidebar nav, editor, AI panel — all collapsible
- **Light & dark themes** across every surface

### Intelligence Engines
| Engine | What it does |
|---|---|
| 💡 **Insights** | Extracts structured pain points, behaviors, segments, opportunities from raw text |
| 🧭 **Decision** | Suggests what to build next, with priority, justification, and expected impact |
| 📊 **Score Evolution** | Tracks how a decision's confidence shifts over time as new evidence arrives |
| 📄 **PRD Generator** | Produces complete PRDs from notes — problem, solution, metrics, risks, timeline |
| ✅ **Task Generator** | Decomposes a PRD into a prioritized 90-day plan with dependencies |
| 🔁 **Learning** | Compares expected vs. actual outcomes and feeds the delta back into future scoring |

### AI Copilot Panel
- **Streaming chat** that reads the active document; 30s timeout via `AbortController`
- **One-click shortcuts** — Generate PRD, Extract Insights, Suggest Tasks
- **Proactive signals** — surfaces repeated keywords, weak assumptions, and opportunity cues as you type

### Public Platform
- **Cases** — every published decision becomes a permanent record at `/c/{caseId}` with reasoning trace, scores, and post-launch outcome
- **Profiles** — `/u/{userId}` shows a user's published cases and rolling score average
- **Publish validation** — `publishCase` requires an expected outcome (metric + target + timeframe) before going public, so every case can be graded later

### Auth & Persistence
- **Google Sign-In** via Firebase Auth, with token refresh and cross-tab session sync
- **First-login provisioning** auto-creates `users/{uid}` in Firestore
- **Firestore subcollections** for documents, insights, PRDs, tasks, decisions, and public cases
- **Graceful 401 recovery** — token refresh + retry on auth failure

---

## 🧩 Application Surface

### Routes
| Path | Purpose |
|---|---|
| `/` | Landing page + workspace shell (auth-gated) |
| `/c/[caseId]` | Public read-only case viewer |
| `/u/[userId]` | Public user profile |
| `/api/chat` | Next.js route proxying streaming Groq chat |

### Workspace Views
**Editor** · **Insights** · **Decisions** · **PRDs** · **Tasks** · **Platform**

---

## 🛠️ Technical Stack

### Frontend
- **Next.js 16** (App Router) · **React 19** · **TypeScript** (strict mode)
- **TipTap** headless editor framework
- **Zustand** state with localStorage persistence (`useAppStore`)
- **Firebase Web SDK** — Auth + Firestore
- **Groq SDK** — Llama-3.3-70B-versatile

### Backend (`backend/`)
- **Fastify** with **Pino** structured logging
- **Zod** validation on every route
- **Prisma → PostgreSQL** — 9 models covering AI outputs, prompt cache (60-min TTL), per-user usage telemetry, and decision reasoning traces
- **Firebase Admin SDK** verifying ID tokens on every protected route
- **Groq SDK** with prompt-cache dedup and per-call cost logging

### Backend Endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | `/ai/insights/generate` | Extract insights from content |
| POST | `/ai/prd/generate` | Generate PRD from notes / decisions |
| POST | `/ai/tasks/suggest` | Suggest tasks from a PRD |
| POST | `/ai/patterns/analyze` | Detect patterns in live text |
| POST | `/ai/decision/score` | Score a decision with reasoning trace |
| GET  | `/ai/usage/:date` | Daily token + cost usage |
| POST | `/ai/chat` | Streaming chat |
| GET  | `/health` | Liveness probe |

---

## 🗂️ Repository Layout

```
buildcase/
├── src/
│   ├── app/                    # Next.js App Router (layout, /, /c, /u, /api)
│   ├── components/
│   │   ├── ai/                 # AIPanel
│   │   ├── editor/             # TipTapEditor, InlineSuggestion
│   │   ├── decision/           # ScoreCard, BreakdownChart, ScoreHistoryGraph
│   │   ├── outcome/            # OutcomeCard, LearningInsight, ScoreAdjustment
│   │   ├── platform/           # CaseViewer, PublicProfilePage, WorkspaceDashboard
│   │   ├── views/              # Editor / Insights / Decisions / PRDs / Tasks / Platform
│   │   ├── layout/             # Shell, SidebarNav, LandingPage
│   │   └── ui/                 # shadcn primitives
│   ├── lib/
│   │   ├── ai/                 # actions + engines (insights, score, learning, comparison)
│   │   ├── firebase/           # AuthProvider, config, db
│   │   └── platform/           # caseBuilder, publishCase
│   ├── store/                  # Zustand store
│   └── hooks/
├── backend/
│   ├── src/                    # Fastify server, routes, services
│   └── prisma/                 # schema (migrations pending)
├── public/                     # static assets
├── docs/archive/               # historical design docs
├── prd.md                      # product requirements
├── roadmap.md                  # phased plan
└── firestore.rules             # Firestore security rules
```

---

## 📍 Status

**Phase 1 (MVP) — substantially complete.** The end-to-end loop works: write → insight → decision → PRD → tasks → publish → outcome. Editor, AI panel, all six engines, public profiles, and the publish flow are wired through Firestore and Groq.

**Known gaps before production launch:**
- Frontend AI calls hit Groq directly from the browser; the Fastify backend exists but isn't yet wired into the UI workflows
- No Prisma migrations committed yet
- No automated tests (vitest is installed but unused)
- No CI/CD, Dockerfile, or staging environment
- Comments UI on cases is scaffolded but lacks backend handlers
- Auth is Google-only — no email/password fallback

---

## 🔮 Roadmap

### Phase 2 — Team Collaboration & Connectivity
- **Multiplayer** — real-time co-authoring and decision-making for product squads
- **Workflow Integrations** — bi-directional sync with Slack, Zendesk, Gong (inputs) and Linear, Jira, GitHub (execution)
- **Comments & discussion** — threaded conversation on every published case

### Phase 3 — The Autonomous Product Assistant
- **AI-driven iteration loops** — scheduled post-launch outcome checks that auto-suggest the next iteration
- **Deep synthesis at scale** — ingest thousands of feedback points and synthesize a coherent strategy
- **Data-driven impact analysis** — connect Mixpanel / Amplitude to validate whether shipped PRDs hit their target metrics

---

## ⚙️ Local Setup

```bash
# 1. Frontend env
cp .env.example .env.local
# fill in GROQ_API_KEY + NEXT_PUBLIC_FIREBASE_* values

# 2. Backend env
cp backend/.env.example backend/.env
# fill in GROQ_API_KEY, Firebase Admin service account, DATABASE_URL

# 3. Install
npm install
cd backend && npm install && cd ..

# 4. Run
npm run dev                    # Next.js on :3000
cd backend && npm run dev      # Fastify on :3001
```

See [.env.example](.env.example) and [backend/.env.example](backend/.env.example) for the full variable lists.
