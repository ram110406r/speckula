# SPECKULA — Current Architecture Audit

## 1. Executive Architecture Summary

SPECKULA is an **AI-native product intelligence workspace** designed to unify product manager workflows from raw customer signals to structured decisions, PRDs, roadmaps, and execution tasks.

The system is deployed as a multi-tier hybrid architecture:
- **Frontend App**: Next.js 15 (App Router) with React 19, TypeScript 5, Tailwind CSS v4, TipTap rich text editor, Zustand state management, and Sentry observability.
- **Backend API**: Fastify v5 application in TypeScript, running on Node.js >= 18, providing REST endpoints, Server-Sent Events (SSE), and WebSockets.
- **Storage Tier (Dual DB Architecture)**:
  - **Firebase Cloud Firestore**: Serves as the real-time source of truth for user documents, research notes, decisions, PRDs, tasks, and client-facing entities.
  - **PostgreSQL (via Prisma ORM 7 + `pgvector`)**: Stores AI compute telemetry (`PromptLog`, `APIUsage`), prompt caches (`PromptCache`), vector embeddings (`SemanticEmbedding`, `ProductBrainEntry`), competitor tracking (`CompetitorInsight`, `CompetitorMonitor`), market signals (`MarketSignal`), asynchronous job queues (`AnalysisJob`), workspaces, decisions shadow data, and outcomes.
- **Background Worker Tier**: Redis-backed BullMQ processing worker (`analysisWorker.ts`) for web crawling, AI extraction, page classification, and vector embedding.
- **AI Processing Engine**: Groq SDK (`llama-3.3-70b-versatile` and `llama-3.1-8b-instant`) for ultra-low-latency LLM inference, combined with OpenAI (`text-embedding-3-small`) for vector embeddings.

---

## 2. Component Topology & Data Flow

```text
[ Browser Extension / Client Browser ]
           │
           ├── (Direct Real-time Sync) ──> [ Firebase Cloud Firestore ]
           │                                          ▲
           ├── (REST / SSE / WebSockets)              │ (Server-side Admin Sync)
           ▼                                          │
[ Next.js 15 App Router Frontend ] ───────────────────┤
           │                                          │
           ├── (Bearer Token Auth REST API)           │
           ▼                                          │
[ Fastify v5 Backend Service Layer ] ─────────────────┘
     │            │             │
     │ (ORM)      │ (BullMQ)    │ (Llama 3.3/3.1)
     ▼            ▼             ▼
[ PostgreSQL ] [ Redis ]  [ Groq AI API ]
 (pgvector)       │             │
                  ▼             │
          [ BullMQ Worker ] ────┘
```

### Key Interaction Flows:
1. **Research & Note Taking**: User edits notes in the TipTap editor. State auto-saves debounced to Firestore every 2 seconds. Inline AI suggestions hit `/ai/insights/generate` via Fastify proxy.
2. **Signal Extraction & Product Brain Ingestion**: Browser extension or user pastes URLs/transcripts -> Fastify `/extension/analyze` enqueues a job into Redis -> BullMQ `analysisWorker` extracts text, classifies page, calls Groq LLM, generates embeddings via OpenAI API, writes to `ProductBrainEntry` + `SemanticEmbedding` in PostgreSQL, and broadcasts status via WebSockets (`wsManager`).
3. **Decision Scoring & Case Generation**: User scores a product decision -> Fastify `/ai/decision/score` retrieves contextual grounding from `aiGroundingService`, calls Groq reasoning model, calculates impact/effort/confidence/demand metrics, and upserts `DecisionReasoning` in PostgreSQL.
4. **Outcome Learning Loop**: Upon recording actual post-launch metrics against expected targets, Fastify `/outcomes` computes deviation percentage, invokes `learningService` to generate a `LearningInsight`, and updates Product Brain confidence scores.

---

## 3. Technology Stack & Dependencies

| Layer | Framework / Library | Purpose |
|---|---|---|
| **Frontend Framework** | Next.js 16.2.3 / React 19.2.4 | Server & Client Rendered UI, App Router |
| **Styling & Components** | Tailwind CSS v4, `@base-ui/react`, `lucide-react` | CSS-first design system & icons |
| **Rich Text Editor** | TipTap v3 (`@tiptap/react`, `@tiptap/starter-kit`) | Distraction-free research editor with inline AI |
| **State Management** | Zustand v5 (with `persist` middleware) | Global UI state & cross-view handoffs |
| **Backend Runtime** | Node.js >= 18.0.0, Fastify v5.0.0 | High-performance async API server |
| **Database ORM** | Prisma v7.0.0 (`@prisma/client`, `@prisma/adapter-pg`) | PostgreSQL schema management & type-safe queries |
| **Primary Databases** | PostgreSQL 16 (`pgvector`) & Firebase Firestore | Relational/Vector analytics & NoSQL real-time document storage |
| **Job Queue & Cache** | BullMQ v5.0.0, ioredis v5.3.2, Redis 7 | Distributed async task queue & prompt cache |
| **AI LLM Inference** | Groq SDK (`groq-sdk` v0.4.0) | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant` |
| **Vector Embeddings** | OpenAI API (`openai` v4.0.0) | `text-embedding-3-small` (1536 dimensions) |
| **Authentication** | Firebase Admin SDK (`firebase-admin` v12.7.0) | Google OAuth + Firebase ID Token verification |
| **Email & Comms** | Resend SDK (`resend` v4.0.0), Slack Web API | Notifications, weekly digests, Slack ingestion |
| **Observability** | `@sentry/nextjs` v8, `@sentry/node` v8, Pino | Error tracking & structured JSON logging |

---

## 4. Dual-Database Storage Strategy

SPECKULA operates a **hybrid storage architecture**:

### 1. Firebase Firestore (NoSQL Document Store)
- **Collections**: `users/{userId}/documents`, `users/{userId}/decisions`, `users/{userId}/prds`, `users/{userId}/tasks`, `users/{userId}/outcomes`, `workspaces/{workspaceId}`.
- **Role**: Client-side reactive source of truth. Next.js components subscribe directly using Firestore `onSnapshot` listeners for low-latency collaborative document updates.

### 2. PostgreSQL + `pgvector` (Relational & Vector Store)
- **Models**: `Workspace`, `WorkspaceMember`, `ProductBrainEntry`, `SemanticEmbedding`, `CompetitorInsight`, `CompetitorMonitor`, `MarketSignal`, `DecisionReasoning`, `Outcome`, `LearningInsight`, `AnalysisJob`, `Agent`, `AgentRun`, `RoadmapItem`, `Experiment`, `PromptLog`, `PromptCache`, `APIUsage`, `ActivityLog`.
- **Role**: Deep product intelligence, multi-tenant workspace relationships, high-cardinality aggregation, prompt caching, background worker progress tracking, and vector similarity search.

---

## 5. Architectural Strengths & Current Bottlenecks

### Strengths:
- **Ultra-Fast AI Inference**: Groq integration yields sub-second responses for signal analysis and decision scoring.
- **Robust Ingestion Pipeline**: Asynchronous BullMQ worker isolates heavy web scraping and AI extraction from the API server thread.
- **High-Fidelity Prompt Telemetry**: `PromptLog` and `APIUsage` track token consumption, costs, and cache hit rates accurately.

### Critical Bottlenecks & Architectural Risks:
- **Storage Fragmentation**: Dual source of truth between Firestore and PostgreSQL creates orphan risk and consistency lag (e.g., Firestore decisions deleted while PostgreSQL `DecisionReasoning` rows persist).
- **Missing Enterprise RBAC**: `requireWorkspaceRole` in `workspaceAuth.ts` supports basic roles (`owner`, `admin`, `editor`, `viewer`), but lacks fine-grained resource permissions, team boundaries, or organization-level tenancy.
- **Grounding Recency Bias**: `aiGroundingService.ts` currently fetches recent entries rather than utilizing vector similarity search (`semanticSearch`) for grounded AI prompts.
