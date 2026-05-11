# Speckula — Deployment Guide

## 1. Prerequisites

- **Docker** 24+ and **Docker Compose** v2 (`docker compose version`)
- **Git** — repository cloned to the target server
- A **Dokploy** account and project (for managed VPS deployment), or any Linux host with Docker
- **Firebase project** with a service account (for auth)
- **Groq** API key (AI analysis)

---

## 2. Environment Variables Setup

Two `.env.example` files document every available variable:

| File | Used by |
|------|---------|
| `e:\SPECKULA\.env.example` | Next.js frontend (build-time + runtime) |
| `e:\SPECKULA\backend\.env.example` | Fastify backend + worker |

Create the actual env files:

```bash
cp .env.example .env.local          # frontend (Next.js reads .env.local)
cp backend/.env.example backend/.env
```

For Docker Compose / Dokploy, all variables are passed as a single flat `.env` at the repo root — see docker-compose.yml for the mapping.

### Required Variables (minimum to start)

**Backend:**
- `DATABASE_URL`, `DIRECT_DATABASE_URL` — PostgreSQL connection strings
- `REDIS_URL` — BullMQ job queue
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY_B64`
- `GROQ_API_KEY`
- `FRONTEND_URL` — for CORS allow-list

**Frontend (build-time `ARG`):**
- All `NEXT_PUBLIC_FIREBASE_*` variables

---

## 3. Firebase Private Key (Base64)

Docker environments mangle `\n` in private keys. Use the base64 form instead:

```bash
# Extract private_key from your service account JSON and base64-encode it
cat firebase-service-account.json | python3 -c \
  "import sys, json, base64; k=json.load(sys.stdin)['private_key']; print(base64.b64encode(k.encode()).decode())"

# Or on Linux:
jq -r .private_key firebase-service-account.json | base64 -w 0
```

Paste the output as `FIREBASE_PRIVATE_KEY_B64`.

---

## 4. Local Development with Docker Compose

```bash
# 1. Create your .env file at the repo root
cp .env.example .env          # edit with real values

# 2. Start all services (db, redis, backend, worker, frontend, nginx)
docker compose up --build

# 3. The app is available at http://localhost:80
#    Backend API direct: http://localhost:3001
```

Services: `db` (PostgreSQL + pgvector), `redis`, `backend` (Fastify), `worker` (BullMQ), `frontend` (Next.js), `nginx` (reverse proxy).

---

## 5. Deploying to Dokploy

1. **Create a new Application** in Dokploy → point it at your Git repository
2. **Build type:** Docker Compose
3. **Compose file:** `docker-compose.yml` (repo root)
4. **Add environment variables** — paste the contents of your `.env` file into Dokploy's environment editor
5. **Deploy** — Dokploy pulls the repo, builds images, and starts the stack
6. **Attach a domain** in Dokploy → the nginx service listens on port 80; Dokploy handles SSL termination

> The `dokploy-network` external network (declared in `docker-compose.yml`) is created automatically by Dokploy. Do not remove it.

---

## 6. Database Migrations

Migrations run automatically on backend container startup:

```bash
# Entrypoint in docker-compose.yml:
npx prisma migrate deploy && node dist/index.js
```

To run migrations manually:

```bash
docker compose exec backend npx prisma migrate deploy
```

To reset the database in development:

```bash
docker compose exec backend npx prisma migrate reset --force
```

---

## 7. Scaling Workers

Analysis workers are a separate service and can be scaled independently:

```bash
# Run 3 worker replicas (for high job throughput)
docker compose up --scale worker=3

# In Dokploy: set the "Replicas" field on the worker service
```

Each worker reads `ANALYSIS_WORKER_CONCURRENCY` (default `5`) for BullMQ concurrency.

---

## 8. Health Check Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /health` | None | Liveness — returns `{ ok: true }` |
| `GET /health/metrics` | `Authorization: Bearer $METRICS_TOKEN` | Detailed stats (jobs, DB pool, Redis) |
| `GET /ws/connections` | `Authorization: Bearer $METRICS_TOKEN` | Live WebSocket connection count |

```bash
# Basic liveness
curl https://yourdomain.com/api/health

# Metrics (requires METRICS_TOKEN)
curl -H "Authorization: Bearer $METRICS_TOKEN" https://yourdomain.com/api/health/metrics
```

---

## 9. Monitoring — What to Watch

```bash
# Tail all service logs
docker compose logs -f

# Backend only
docker compose logs -f backend

# Worker job processing
docker compose logs -f worker

# Check for OOM kills or crash loops
docker compose ps
```

Key log signals:
- `prisma migrate deploy — success` — migrations ran cleanly on startup
- `Fastify listening on 0.0.0.0:3001` — backend is up
- `BullMQ worker ready` — analysis worker connected to Redis
- `ERROR` lines in backend logs — check for Firebase auth failures or DB connection errors

---

## 10. Common Issues

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Backend exits with `P1001` | DB not ready yet | Wait for `db` healthcheck; `depends_on` handles this automatically |
| `FirebaseAuthError: invalid credential` | Malformed private key | Re-encode `FIREBASE_PRIVATE_KEY_B64` (step 3) |
| Jobs stuck in `queued` state | Worker not running or Redis unreachable | Check `docker compose ps worker` and `REDIS_URL` |
| CORS errors from browser | `FRONTEND_URL` / `FRONTEND_URLS` mismatch | Set to the exact origin (no trailing slash) |
| Next.js build fails | Missing `NEXT_PUBLIC_FIREBASE_*` build args | All `NEXT_PUBLIC_*` vars must be set as Docker build `ARG`s — check docker-compose.yml |
| `METRICS_TOKEN` 401 | Token not set or wrong header | Set `METRICS_TOKEN` env var; pass as `Authorization: Bearer <token>` |
| DB volume data lost after redeploy | Wrong volume name | Volume is `pg_data_v2` — do not rename it between deploys |
