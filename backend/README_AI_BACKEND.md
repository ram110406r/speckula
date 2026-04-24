# BuildCase AI Backend

High-performance AI service layer powered by **Groq** with Firebase integration.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│          Firebase Auth + Firestore (source of truth)        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ REST API + WebSocket
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Backend (Fastify + Groq)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ AI Operations                                       │   │
│  │ - Generate insights (mixtral-8x7b)                 │   │
│  │ - Generate PRDs (llama3-70b)                       │   │
│  │ - Score decisions (llama3-70b)                     │   │
│  │ - Suggest tasks (mixtral-8x7b)                     │   │
│  │ - Analyze patterns (mixtral-8x7b)                  │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ PostgreSQL (Cache & AI Outputs)                     │   │
│  │ - AIInsight, AIPRD, DecisionReasoning              │   │
│  │ - PatternAnalysis, PromptLog, PromptCache          │   │
│  │ - AISuggestedTask, APIUsage, ActiveConnection      │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                       │
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              External Services                               │
│  - Groq API (mixtral-8x7b, llama3-70b)                      │
│  - Firebase Admin SDK                                       │
└──────────────────────────────────────────────────────────────┘
```

## Features

✨ **Two-Tier AI Strategy**
- **Fast**: mixtral-8x7b for instant feedback (patterns, suggestions)
- **Reasoning**: llama3-70b for deep analysis (PRDs, insights, scoring)

🔄 **Intelligent Caching**
- Prompt-based deduplication with SHA256 hash
- TTL-based cache expiration
- Cost & token tracking

🔐 **Firebase Integration**
- Firebase Auth validation via Admin SDK
- Firestore as source of truth
- PostgreSQL as cache layer

📊 **Cost Tracking**
- Per-request token counting
- Daily usage aggregation
- Cost estimation per model

⚡ **Real-time Capabilities**
- WebSocket support via fastify-websocket
- Live pattern analysis
- Active connection tracking

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Groq API key ([Get one](https://console.groq.com))
- Firebase service account JSON

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/buildcase"

# Groq
GROQ_API_KEY="gsk_your_api_key_here"

# Firebase
FIREBASE_PROJECT_ID="buildcase-f103a"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL="firebase-adminsdk@buildcase-f103a.iam.gserviceaccount.com"

# Server
PORT=3001
NODE_ENV="development"
FRONTEND_URL="http://localhost:3000"
```

### 3. Setup PostgreSQL

```bash
# On Windows with PostgreSQL installed
psql -U postgres -c "CREATE DATABASE buildcase"

# Or use Docker
docker run --name buildcase-db \
  -e POSTGRES_DB=buildcase \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15
```

### 4. Run Migrations

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 5. Start Development Server

```bash
npm run dev
```

Server runs on `http://localhost:3001`

## API Endpoints

### AI Operations

#### Generate Insights
```bash
POST /ai/insights/generate
Content-Type: application/json

{
  "projectId": "firebase-project-id",
  "noteId": "firebase-note-id",
  "content": "Note content to analyze",
  "userId": "firebase-user-id"
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "insights": [
      {
        "id": "uuid",
        "content": "Insight text",
        "confidenceScore": 0.85,
        "modelUsed": "mixtral-8x7b-32768"
      }
    ],
    "summary": "Summary of all insights",
    "tokensUsed": 245
  }
}
```

#### Generate PRD
```bash
POST /ai/prd/generate
Content-Type: application/json

{
  "projectId": "firebase-project-id",
  "title": "Product Name",
  "notes": "All project notes combined",
  "decisions": "Key decisions made",
  "userId": "firebase-user-id"
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "prd": {
      "id": "uuid",
      "title": "Product Name",
      "content": "Full markdown PRD..."
    },
    "tokensUsed": 1250
  }
}
```

#### Suggest Tasks
```bash
POST /ai/tasks/suggest
Content-Type: application/json

{
  "projectId": "firebase-project-id",
  "prdContent": "Full PRD markdown",
  "prdId": "firebase-prd-id",
  "userId": "firebase-user-id"
}
```

#### Analyze Patterns
```bash
POST /ai/patterns/analyze
Content-Type: application/json

{
  "projectId": "firebase-project-id",
  "noteId": "firebase-note-id",
  "content": "Text to analyze for patterns",
  "userId": "firebase-user-id"
}
```

#### Score Decision
```bash
POST /ai/decision/score
Content-Type: application/json

{
  "projectId": "firebase-project-id",
  "decisionId": "firebase-decision-id",
  "title": "Decision title",
  "description": "What needs to be decided",
  "context": "Surrounding context",
  "userId": "firebase-user-id"
}
```

### Usage Tracking

#### Get Daily Usage
```bash
GET /ai/usage/:userId/:date
# Example: /ai/usage/user123/2024-01-15
```

Response:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "userId": "user123",
    "date": "2024-01-15T00:00:00Z",
    "totalRequests": 42,
    "totalTokens": 15000,
    "totalCost": 3.45,
    "modelMix": "{\"mixtral-8x7b-32768\": 30, \"llama3-70b-8192\": 12}"
  }
}
```

## Database Schema

### AI Output Models

**AIInsight**: Generated insights from notes
- Stores: content, confidence, model, tokens, expiration

**AIPRD**: Generated product requirements
- Stores: full markdown, version, model, tokens

**DecisionReasoning**: Reasoning traces for decisions
- Stores: prompt, reasoning, confidence breakdown

**PatternAnalysis**: Real-time pattern detection
- Stores: keywords, weak signals, suggestions (JSON)

**AISuggestedTask**: Task suggestions from PRDs
- Stores: title, description, priority, reasoning

### Metadata Models

**PromptLog**: Complete API call history
- Stores: prompt hash, full prompt, tokens, cost, execution time
- Indexes: userId, projectId, promptHash, date

**PromptCache**: Deduplication cache
- Stores: prompt hash, cached result, hit count
- TTL: Configurable (default 60 minutes)

**APIUsage**: Daily aggregated usage
- Stores: request count, total tokens, total cost
- Indexes: userId, date (unique together)

**ActiveConnection**: WebSocket metadata
- Stores: user, project, connection ID, heartbeat

## Model Selection Guide

### Use mixtral-8x7b (Fast)
- Pattern analysis (< 2s latency target)
- Task suggestions from structured PRDs
- Quick feedback on typing (debounce 1-2s)
- Lightweight classifications

**Cost**: $0.24 per 1M tokens

### Use llama3-70b (Reasoning)
- Insight generation from notes
- PRD generation (longer outputs, reasoning)
- Decision scoring with confidence breakdown
- Complex reasoning chains

**Cost**: $0.59 per 1M tokens

## Performance Targets

| Operation | Model | Latency | Use Case |
|-----------|-------|---------|----------|
| Pattern Analysis | mixtral | <2s | Live typing feedback |
| Task Suggestions | mixtral | <3s | PRD review |
| Insights | llama3 | <5s | Note processing |
| PRD Generation | llama3 | <15s | Batch operation |
| Decision Score | llama3 | <5s | Review workflow |

## Monitoring

### Logs
```bash
# All requests logged via Pino
npm run dev  # Shows pretty-printed logs
```

### Cost Tracking
Query the database:
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as requests,
  SUM(total_tokens) as tokens,
  SUM(cost) as cost
FROM "PromptLog"
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Cache Performance
```sql
SELECT 
  model_used,
  COUNT(*) as hits,
  AVG(hit_count) as avg_hits_per_entry
FROM "PromptCache"
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY model_used;
```

## Development

### Type Check
```bash
npm run type-check
```

### Lint
```bash
npm run lint
```

### Run Tests
```bash
npm run test
```

### Build for Production
```bash
npm run build
NODE_ENV=production node dist/index.js
```

## Deployment

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY prisma ./prisma
RUN npx prisma generate
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### Environment Variables for Production
- Ensure `NODE_ENV=production`
- Use strong `JWT_SECRET`
- Enable `PROMPT_CACHE_ENABLED=true`
- Set appropriate `AI_CACHE_TTL_MINUTES`

## Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
Check PostgreSQL is running and DATABASE_URL is correct.

### Groq API Key Invalid
```
Error: Invalid API key provided
```
Verify GROQ_API_KEY in .env file.

### Prisma Migration Failed
```bash
# Reset database (careful in production!)
npx prisma migrate reset
npx prisma migrate deploy
```

### Port Already in Use
```bash
# Kill process on port 3001
lsof -i :3001
kill -9 <PID>
```

## Next Steps

1. ✅ Core AI endpoints functional
2. 🔄 WebSocket real-time updates (in progress)
3. 📊 Dashboard with usage analytics
4. 🔐 Role-based access control
5. 📈 Performance optimizations
6. 🧪 Comprehensive test suite

## Support

For issues or questions:
1. Check [Groq Documentation](https://console.groq.com/docs)
2. Review [Fastify Guide](https://www.fastify.io/)
3. Check server logs: `npm run dev`
4. Database queries in `npm run prisma:studio`
