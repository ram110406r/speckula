# Buildcase AI Backend

Groq-powered AI cache and compute layer for Buildcase. Firestore remains the
source of truth for user data; this service is a thin, stateless AI worker with
a PostgreSQL-backed cache and telemetry store.

## Stack
- **Runtime**: Node.js >= 18
- **Framework**: Fastify 4
- **AI**: Groq (`llama-3.3-70b-versatile`)
- **DB**: PostgreSQL via Prisma (AI outputs, prompt cache, usage metrics)
- **Auth**: Firebase Admin SDK (verifies ID tokens minted on the frontend)

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then fill values
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Server listens on `http://localhost:3001`.

## Endpoints

All `/ai/*` routes require an `Authorization: Bearer <firebase-id-token>`
header. `userId` is taken from the verified token, not the request body.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness probe |
| POST | `/ai/insights/generate` | Extract insights from note content |
| POST | `/ai/prd/generate` | Generate a PRD from notes + decisions |
| POST | `/ai/tasks/suggest` | Suggest tasks from a PRD |
| POST | `/ai/patterns/analyze` | Detect patterns in live text |
| POST | `/ai/decision/score` | Score a decision's confidence |
| GET | `/ai/usage/:date` | Daily token/cost usage for the caller |

Response envelope: `{ ok: true, data }` on success, `{ ok: false, error }`
on failure.

## Scripts
- `npm run dev` — watch mode via `tsx`
- `npm run build` — compile to `dist/`
- `npm start` — run the compiled server
- `npm run type-check` — `tsc --noEmit`
- `npm run lint` — ESLint
- `npm test` — Vitest

## Status

The frontend currently calls Groq directly from a Next.js API route and does
not use this service. This backend is kept for future work where AI caching,
cost tracking, and multi-tenant quota controls matter.
