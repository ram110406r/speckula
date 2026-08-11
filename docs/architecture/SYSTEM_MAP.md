# SPECKULA — System Map & Dependency Matrix

## 1. High-Level Dependency Graph

```text
                                [ Next.js Frontend ]
                                         │
        ┌────────────────────────────────┼──────────────────────────────┐
        │                                │                              │
        ▼                                ▼                              ▼
[ AuthProvider ]                [ Zustand Store ]             [ TipTap Editor ]
        │                                │                              │
        │ Firebase Auth Token            │ View Handoff State           │ Inline AI & Autosave
        ▼                                ▼                              ▼
[ Firebase Auth ]               [ API Hooks (useApi) ]       [ Firestore Repo ]
                                         │
                                         ▼ (HTTP / SSE / WebSockets)
                         [ Fastify v5 API Server ]
                                         │
     ┌───────────────────┬───────────────┼───────────────┬──────────────┐
     │                   │               │               │              │
     ▼                   ▼               ▼               ▼              ▼
[ Auth Middleware ] [ Zod Valid. ]  [ Fastify WS ]  [ Sentry ]   [ Rate Limiter ]
     │                   │               │               │              │
     └───────────────────┴───────┬───────┴───────────────┴──────────────┘
                                 │
                                 ▼
                     [ Business Services Layer ]
                     - groqService
                     - productBrainService
                     - aiGroundingService
                     - learningService
                     - websocketManager
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
 [ Prisma ORM 7 ]        [ BullMQ Queue ]         [ Groq SDK API ]
         │                       │                       │
         ▼                       ▼                       │ Llama 3.3 / 3.1
  [ PostgreSQL ]            [ Redis ]                    │ Inference
   (pgvector)                    │                       │
                                 ▼                       │
                       [ BullMQ Worker ] ────────────────┘
                        (analysisWorker)
```

---

## 2. Feature View Matrix (Frontend to Backend Map)

Below is the complete mapping of all 20 frontend feature views to their corresponding components, state stores, API routes, database collections/models, and AI integrations.

| Feature View | UI Entry Component | Primary Hooks / State | API Routes Hit | Primary DB Stores | AI Model / Integration |
|---|---|---|---|---|---|
| **Workspace** | `WorkspaceView.tsx` | `useAppStore`, `useApi` | `GET /workspaces/:id/dashboard`, `GET /workspaces/:id/activity` | PostgreSQL (`WorkspaceActivity`, `WorkspaceMetrics`) | None |
| **Dashboard** | `DashboardView.tsx` | `useDashboard`, `useAppStore` | `GET /workspaces/:id/dashboard`, `GET /market/signals`, `GET /competitors` | Firestore (`decisions`), PostgreSQL (`MarketSignal`, `CompetitorInsight`) | None |
| **Editor (Research)** | `TipTapEditor.tsx` | `useAppStore`, `useAuth` | `POST /ai/insights/generate`, `POST /ai/patterns/analyze` | Firestore (`documents`), PostgreSQL (`AIInsight`, `PatternAnalysis`) | Groq `llama-3.3-70b-versatile` |
| **Market Intelligence** | `InsightsView.tsx` | `useMarketSignals` | `GET /market/signals`, `POST /ai/signals/analyze` | PostgreSQL (`MarketSignal`) | Groq `llama-3.1-8b-instant` |
| **Competitors** | `CompetitorsView.tsx` | `useCompetitors` | `GET /competitors`, `POST /competitors/monitors` | PostgreSQL (`CompetitorInsight`, `CompetitorMonitor`) | Groq `llama-3.3-70b-versatile` via worker |
| **Product Brain** | `ProductBrainView.tsx` | `useProductBrain` | `GET /product-brain/entries`, `GET /product-brain/search` | PostgreSQL (`ProductBrainEntry`, `SemanticEmbedding`) | OpenAI `text-embedding-3-small` |
| **Decisions** | `DecisionView.tsx` | `useAppStore`, Firestore `onSnapshot` | `POST /ai/decision/score`, `POST /outcomes` | Firestore (`decisions`), PostgreSQL (`DecisionReasoning`, `Outcome`) | Groq `llama-3.3-70b-versatile` |
| **Specifications (PRDs)** | `PRDsView.tsx` | `useAppStore` | `POST /ai/prd/generate`, `POST /ai/prd/stream` | Firestore (`prds`), PostgreSQL (`AIPRD`) | Groq `llama-3.3-70b-versatile` (SSE streaming) |
| **Roadmaps** | `RoadmapsView.tsx` | `useAppStore` | `GET /roadmaps`, `POST /roadmaps/generate` | PostgreSQL (`RoadmapItem`) | Groq `llama-3.3-70b-versatile` |
| **Experiments** | `ExperimentsView.tsx` | `useExperiments` | `GET /experiments`, `POST /experiments/:id/variants` | PostgreSQL (`Experiment`, `ExperimentVariant`) | Statistical hypothesis engine |
| **Tasks** | `TasksView.tsx` | `useAppStore` | `POST /ai/tasks/suggest` | Firestore (`tasks`), PostgreSQL (`AISuggestedTask`) | Groq `llama-3.1-8b-instant` |
| **Cases (Projects)** | `PublicProfilePage.tsx` | Firestore `onSnapshot` | `GET /u/:userId`, `GET /c/:caseId` | Firestore (`decisions`, `outcomes`) | None |
| **Integrations** | `SlackView.tsx` | `useApi` | `GET /slack/channels`, `POST /slack/import` | PostgreSQL (`ProductBrainEntry`, `MarketSignal`) | Groq `llama-3.1-8b-instant` |
| **Autonomous Mode** | `AutonomousModeView.tsx` | `useAppStore` | `POST /agent-runs`, `GET /agent-runs/:id` | PostgreSQL (`AgentRun`) | Groq multi-step reasoning agent stream |
| **Agents** | `AgentsView.tsx` | `useAgents` | `GET /agents`, `GET /agents/jobs` | PostgreSQL (`Agent`, `AnalysisJob`) | Groq Background Worker |
| **Activity** | `ActivityView.tsx` | `useApi` | `GET /workspaces/:id/activity`, `GET /notifications` | PostgreSQL (`WorkspaceActivity`, `Notification`) | None |
| **Extension** | `ExtensionView.tsx` | `useExtensionPreferences` | `GET /extension/status`, `POST /extension/heartbeat` | PostgreSQL (`ExtensionSession`, `ExtensionHeartbeat`) | None |
| **Notifications** | `NotificationsView.tsx` | `useApi` | `GET /notifications`, `PATCH /notifications/:id/read` | PostgreSQL (`Notification`) | None |
| **Settings** | `SettingsView.tsx` | `useAuth`, `useAppStore` | `PATCH /user/settings`, `DELETE /user/account` | Firestore (`users`), PostgreSQL (`Workspace`) | None |
| **Profile** | `ProfileView.tsx` | `useAuth` | `GET /user/profile`, `PATCH /user/profile` | Firestore (`users`) | None |
| **Help** | `HelpView.tsx` | Static UI | None | None | None |

---

## 3. Communication Protocols

1. **REST over HTTP (JSON)**: Synchronous request-response for resource mutations, authentication, and paginated lists.
2. **Server-Sent Events (SSE)**: Unidirectional streaming endpoint (`POST /ai/prd/stream`) allowing token-by-token PRD rendering in the browser.
3. **WebSockets (WS)**: Real-time broadcast channel (`/ws`) managed by `websocketManager.ts` and `WebSocketConnection` table. Emits job progress (`analysis.progress`), job completion (`analysis.completed`), and workspace activity alerts.
4. **BullMQ Redis Queue**: Inter-process asynchronous messaging queue for decoupled background processing of browser extension analysis jobs and automated tasks.
5. **Firestore Real-time Listeners**: Client-side reactive data synchronization via WebSocket connection maintained directly between the browser and Firebase Cloud Firestore.
