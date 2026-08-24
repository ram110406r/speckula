# Speckula - Deployment Guide

## 1. Prerequisites

- Docker 24+ and Docker Compose v2
- Git, with this repository cloned on the target host
- A Dokploy account and project, or any Linux host with Docker
- Firebase project with a service account, if you want the live auth and data stack
- Groq API key, if you want AI features

## 2. Environment Setup

The repo is split into two deployment modes:

- Frontend showcase only
- Full stack with backend, Postgres, Redis, and nginx

For local development or a full deployment, create the usual env files:

```bash
cp .env.example .env.local
cp backend/.env.example backend/.env
```

For Docker Compose and Dokploy full-stack deploys, the root `.env` file maps all services.

### Required variables for the full stack

Backend:

- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `REDIS_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY_B64`
- `GROQ_API_KEY`
- `FRONTEND_URL`

Frontend build-time args:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## 3. Local Docker Compose

```bash
docker compose up --build
```

The app is available at `http://localhost:80`.

If you want a one-command local starter with built-in defaults, use:

```bash
npm run dev:local
```

That brings up local Postgres, Redis, the backend, the worker, and the frontend on `http://localhost:3000`.

Services:

- `db` - PostgreSQL + pgvector
- `redis` - BullMQ queue
- `migrate` - one-off Prisma migration job
- `backend` - Fastify API
- `worker` - background analysis worker
- `frontend` - Next.js app
- `nginx` - reverse proxy

## 4. Dokploy Setup

### A. Showcase-only deployment

Use this if you just want the project visible online with the UI shell and landing page.

1. Create a new Application in Dokploy and connect your Git repository.
2. Choose Docker Compose as the build type.
3. Set the compose file to `dokploy-compose.yml`.
4. Deploy without adding secrets first.
5. Attach your domain. Dokploy will proxy traffic to the frontend on port `3000`.

This mode is intended for demos and portfolio hosting. It shows the full product shell, but backend actions are not wired up.

### B. Full stack deployment

Use this if you want the real backend stack running too.

1. Create a new Application in Dokploy and connect your Git repository.
2. Choose Docker Compose as the build type.
3. Set the compose file to `docker-compose.yml`.
4. Paste the production env values into Dokploy.
5. Deploy.
6. Attach your domain. Dokploy will terminate SSL, and nginx will serve the stack.

The `dokploy-network` external network in `docker-compose.yml` is created automatically by Dokploy.

## 5. Migrations

Run migrations manually with:

```bash
docker compose run --rm migrate
```

Or inside the backend container:

```bash
docker compose exec backend ./node_modules/.bin/prisma migrate deploy
```

## 6. Health Checks

Useful endpoints:

- `GET /live` - liveness
- `GET /health` - readiness
- `GET /health/metrics` - metrics snapshot

## 7. Common Issues

- Backend exits with `P1001` - the database is not ready yet
- Firebase auth errors - the private key is malformed or not base64 encoded
- Jobs stay queued - the worker or Redis is not running
- CORS issues - check `FRONTEND_URL` and `FRONTEND_URLS`
- Next.js build fails - the `NEXT_PUBLIC_FIREBASE_*` build args are missing for the full stack
