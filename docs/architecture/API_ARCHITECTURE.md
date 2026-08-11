# SPECKULA — API Architecture & Endpoint Inventory

## 1. Fastify Server & Gateway Design

The API tier is built on **Fastify v5**, structured around modular route plugins registered in `backend/src/app.ts`.

Key Gateway Features:
- **Global Rate Limiting**: Managed via `@fastify/rate-limit`, keyed by `userId` (when authenticated) or `req.ip`.
- **CORS Policy**: Configured dynamically via `FRONTEND_URLS` or `FRONTEND_URL` environment variables.
- **Security Headers**: Standardized via `@fastify/helmet`.
- **Custom Error Handler**: Formats internal errors into `{ ok: false, error: string, requestId: string }` response envelopes.
- **Request Tracing**: Assigns a UUID to `X-Request-ID` and appends `X-Response-Time` header.

---

## 2. API Endpoint Inventory

| Method | Path | Purpose | Authentication | Rate Limit | Primary Resource | User Scoping | Workspace Scoping | DB / AI Dependencies |
|---|---|---|---|---|---|---|---|---|
| `GET` | `/health` | Server health check | Public | None | System | None | None | None |
| `WS` | `/ws` | WebSocket gateway connection | Token Query Param | None | WebSockets | `request.userId` | Query `workspaceId` | PostgreSQL (`WebSocketConnection`) |
| `POST` | `/ai/insights/generate` | Surface insights from research notes | `verifyFirebaseAuth` | 100 / hr | `AIInsight` | `request.userId` | Optional | Prisma + Groq Reasoning |
| `POST` | `/ai/prd/generate` | Synchronously generate PRD | `verifyFirebaseAuth` | 100 / hr | `AIPRD` | `request.userId` | Optional | Prisma + Groq Reasoning |
| `POST` | `/ai/prd/stream` | Stream PRD via Server-Sent Events | `verifyFirebaseAuth` | 100 / hr | `AIPRD` | `request.userId` | Optional | Groq SSE Stream |
| `POST` | `/ai/tasks/suggest` | Break down PRD into 5 tasks | `verifyFirebaseAuth` | 100 / hr | `AISuggestedTask` | `request.userId` | Optional | Prisma + Groq Fast |
| `POST` | `/ai/patterns/analyze` | First-pass quality check on notes | `verifyFirebaseAuth` | 100 / hr | `PatternAnalysis` | `request.userId` | Optional | Prisma + Groq Fast |
| `POST` | `/ai/decision/score` | Score decision on impact/effort/conf/demand | `verifyFirebaseAuth` | 100 / hr | `DecisionReasoning` | `request.userId` | Optional | Prisma + Groq Reasoning |
| `POST` | `/ai/signals/analyze` | Extract market signals from raw text | `verifyFirebaseAuth` | 100 / hr | `MarketSignal` | `request.userId` | Optional | Prisma + Groq Fast |
| `GET` | `/ai/usage/:date` | Get daily token usage breakdown | `verifyFirebaseAuth` | 100 / hr | `APIUsage` | `request.userId` | None | Prisma (`APIUsage`) |
| `GET` | `/ai/internal/metrics` | Founder dashboard usage metrics | `verifyFirebaseAuth` | 100 / hr | `APIUsage` | `request.userId` | None | Prisma (`APIUsage`, `PromptLog`) |
| `POST` | `/import/url` | Extract article content from web URL | `verifyFirebaseAuth` | 30 / hr | External URL | `request.userId` | None | `@extractus/article-extractor` |
| `POST` | `/import/pdf` | Extract text from uploaded PDF file | `verifyFirebaseAuth` | 30 / hr | PDF Document | `request.userId` | None | `pdf-parse` |
| `POST` | `/extension/heartbeat` | Extension presence ping | `verifyFirebaseAuth` | 200 / hr | `ExtensionSession` | `request.userId` | Optional | Prisma (`ExtensionSession`) |
| `GET` | `/extension/status` | Fetch extension connection status | `verifyFirebaseAuth` | 60 / hr | `ExtensionSession` | `request.userId` | None | Prisma (`ExtensionSession`) |
| `POST` | `/extension/analyze` | Enqueue page analysis job | `verifyFirebaseAuth` | 60 / hr | `AnalysisJob` | `request.userId` | `requireWorkspaceRole` | Prisma + BullMQ Queue |
| `GET` | `/extension/jobs/:jobId` | Poll analysis job progress | `verifyFirebaseAuth` | 60 / hr | `AnalysisJob` | `request.userId` | None | Prisma (`AnalysisJob`) |
| `GET` | `/product-brain/entries` | List Product Brain entries | `verifyFirebaseAuth` | 200 / hr | `ProductBrainEntry` | `request.userId` | Optional | Prisma (`ProductBrainEntry`) |
| `GET` | `/product-brain/search` | Semantic similarity vector search | `verifyFirebaseAuth` | 200 / hr | `ProductBrainEntry` | `request.userId` | Optional | Prisma (`pgvector`) + OpenAI |
| `POST` | `/product-brain/entries` | Manually create brain entry | `verifyFirebaseAuth` | 200 / hr | `ProductBrainEntry` | `request.userId` | Optional | Prisma + OpenAI Embedding |
| `GET` | `/product-brain/competitors` | List competitor insights & domains | `verifyFirebaseAuth` | 200 / hr | `CompetitorInsight` | `request.userId` | None | Prisma (`CompetitorInsight`) |
| `GET` | `/product-brain/signals` | List market signals | `verifyFirebaseAuth` | 200 / hr | `MarketSignal` | `request.userId` | None | Prisma (`MarketSignal`) |
| `GET` | `/workspaces` | List user workspaces & memberships | `verifyFirebaseAuth` | 60 / hr | `Workspace` | `request.userId` | None | Prisma (`Workspace`, `Member`) |
| `POST` | `/workspaces` | Create new workspace | `verifyFirebaseAuth` | 60 / hr | `Workspace` | `request.userId` | Owner | Prisma (`Workspace`) |
| `GET` | `/workspaces/:id` | Fetch single workspace details | `verifyFirebaseAuth` | 60 / hr | `Workspace` | `request.userId` | `viewer` | Prisma (`Workspace`) |
| `PATCH` | `/workspaces/:id` | Update workspace profile | `verifyFirebaseAuth` | 60 / hr | `Workspace` | `request.userId` | `admin` | Prisma (`Workspace`) |
| `DELETE` | `/workspaces/:id` | Soft-delete workspace | `verifyFirebaseAuth` | 60 / hr | `Workspace` | `request.userId` | `owner` | Prisma (`Workspace`) |
| `POST` | `/workspaces/:id/members` | Invite member to workspace | `verifyFirebaseAuth` | 60 / hr | `WorkspaceMember` | `request.userId` | `admin` | Prisma (`WorkspaceMember`) |
| `DELETE` | `/workspaces/:id/members/:mId` | Remove member from workspace | `verifyFirebaseAuth` | 60 / hr | `WorkspaceMember` | `request.userId` | `admin` | Prisma (`WorkspaceMember`) |
| `GET` | `/workspaces/:id/dashboard` | Workspace dashboard overview | `verifyFirebaseAuth` | 60 / hr | Aggregated | `request.userId` | `viewer` | Prisma Aggregations |
| `GET` | `/workspaces/:id/activity` | Workspace activity audit stream | `verifyFirebaseAuth` | 60 / hr | `WorkspaceActivity` | `request.userId` | `viewer` | Prisma (`WorkspaceActivity`) |
| `POST` | `/outcomes` | Record expected decision outcome | `verifyFirebaseAuth` | 120 / hr | `Outcome` | `request.userId` | Optional | Prisma (`Outcome`) |
| `POST` | `/outcomes/:id/actual` | Record actual metric & trigger learning | `verifyFirebaseAuth` | 120 / hr | `Outcome` | `request.userId` | Optional | Prisma + Groq (`LearningInsight`) |
| `GET` | `/outcomes/:id` | Fetch outcome details & insights | `verifyFirebaseAuth` | 120 / hr | `Outcome` | `request.userId` | None | Prisma (`Outcome`) |
| `GET` | `/roadmaps` | List quarter-scoped roadmap items | `verifyFirebaseAuth` | 60 / hr | `RoadmapItem` | `request.userId` | Optional | Prisma (`RoadmapItem`) |
| `POST` | `/roadmaps/generate` | AI-generated roadmap from decisions | `verifyFirebaseAuth` | 60 / hr | `RoadmapItem` | `request.userId` | Optional | Prisma + Groq Reasoning |
| `GET` | `/experiments` | List A/B experiments & variants | `verifyFirebaseAuth` | 120 / hr | `Experiment` | `request.userId` | Optional | Prisma (`Experiment`) |
| `POST` | `/experiments` | Create experiment | `verifyFirebaseAuth` | 120 / hr | `Experiment` | `request.userId` | Optional | Prisma (`Experiment`) |
| `GET` | `/agents` | List persistent AI agent identities | `verifyFirebaseAuth` | 300 / hr | `Agent` | `request.userId` | Optional | Prisma (`Agent`, `AnalysisJob`) |
| `GET` | `/agent-runs` | List autonomous mode reasoning runs | `verifyFirebaseAuth` | 300 / hr | `AgentRun` | `request.userId` | None | Prisma (`AgentRun`) |
| `POST` | `/agent-runs` | Initiate multi-step autonomous run | `verifyFirebaseAuth` | 300 / hr | `AgentRun` | `request.userId` | Optional | Prisma + Groq Agent Loop |
