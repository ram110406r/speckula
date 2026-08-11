# SPECKULA — AI Architecture & Inference System

## 1. AI Pipeline Topology

SPECKULA's AI infrastructure is designed for low latency, cost efficiency, and structured output reliability.

```text
[ User Prompt / Raw Signals ]
             │
             ▼
   [ Fastify API / Worker ]
             │
             ├── 1. Check Circuit Breaker State (OPEN → 530 Fast Fail)
             │
             ├── 2. Hash Prompt & Check TTL Cache (PromptCache HIT → $0 cost, 0ms)
             │
             ├── 3. Enforce Daily Token Quota (DAILY_TOKEN_QUOTA check)
             │
             ├── 4. Call Groq SDK Inference (Llama 3.3 70B or Llama 3.1 8B)
             │
             ├── 5. Log Telemetry to PromptLog & Rollup to APIUsage
             │
             └── 6. Persist Cache in PromptCache & Return Structured Output
```

---

## 2. Model Routing & Specialization

| Task Type | Target Model | Max Tokens | Temperature | Rationale / Specialization |
|---|---|---|---|---|
| **Pattern Analysis** | `llama-3.1-8b-instant` | 1,500 | 0.6 | Ultra-fast first-pass check on research notes |
| **Signal Extraction** | `llama-3.1-8b-instant` | 4,000 | 0.6 | High-throughput extraction of pain points & trends |
| **Task Suggestion** | `llama-3.1-8b-instant` | 1,500 | 0.6 | Breaking down PRD into 5 action-oriented engineering tasks |
| **Decision Scoring** | `llama-3.3-70b-versatile` | 1,200 | 0.6 | Deep reasoning for Impact/Effort/Confidence/Demand scoring |
| **PRD Generation** | `llama-3.3-70b-versatile` | 4,000 | 0.6 | Structured long-form Markdown PRD creation |
| **PRD Streaming (SSE)** | `llama-3.3-70b-versatile` | 4,000 | 0.6 | Token-by-token real-time streaming to the UI |
| **Learning Insight** | `llama-3.3-70b-versatile` | 1,500 | 0.6 | Causal analysis comparing expected target vs actual metric |
| **Autonomous Mode** | `llama-3.3-70b-versatile` | 4,000 | 0.7 | Multi-step reasoning loop (Quick / Standard / Deep runs) |
| **Vector Embeddings** | `text-embedding-3-small` | 1536 dims | N/A | OpenAI embedding model for Product Brain semantic search |

---

## 3. Resilience, Caching & Telemetry Mechanisms

### 1. Circuit Breaker (`groqService.ts`)
- **State Machine**: `closed` (normal) -> `open` (failing fast) -> `half-open` (probing).
- **Threshold**: Opens after **5 consecutive 4xx auth/validation errors** (401, 400, 422).
- **Exclusions**: 429 (rate limits) and 5xx (transient upstream blips) do NOT trip the breaker, ensuring high availability during minor upstream instability.
- **Cool-down**: 60 seconds delay before allowing a single probe request in `half-open` state.

### 2. Prompt Result Caching (`PromptCache`)
- **Hashing**: SHA-256 hash computed over `(userId, prompt, modelName, jsonMode, temperature)`.
- **TTL**: Configurable via `AI_CACHE_TTL_MINUTES` (defaults to 60 minutes).
- **Cost Offset**: Cache hits return instant results with `$0` token cost and `0ms` latency, recorded as `cachedResult: true` in `PromptLog`.

### 3. Usage & Cost Telemetry (`PromptLog`, `APIUsage`)
- **PromptLog**: Every completion writes execution latency, input tokens, output tokens, total tokens, and USD cost calculated against Groq model rates (`$0.05/$0.08` for 8B; `$0.59/$0.79` for 70B per 1M tokens).
- **APIUsage**: Daily atomic rollups performed via raw PostgreSQL SQL `ON CONFLICT ("userId", "date") DO UPDATE` to track aggregate user quota consumption safely.

### 4. AI Evaluation Framework (`backend/src/eval`)
- Includes automated evaluation scripts (`runEval.ts`) that test output quality, JSON schema compliance, and confidence score calibration against synthetic test sets.
