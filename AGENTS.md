# AGENTS.md

Agent instructions for this workspace.

## Scope
- This repo has two apps:
- Frontend: Next.js (root workspace)
- Backend: Fastify + Prisma (`backend/`)

## Quick Start For Agents
1. Install dependencies in both projects.
2. Run lint/type checks before proposing completion.
3. Keep edits scoped to the app you are changing (root vs `backend/`).

## Commands
### Frontend (root)
- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`

### Backend (`backend/`)
- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`
- Type check: `npm run type-check`
- Lint: `npm run lint`
- Test: `npm run test`
- Prisma generate: `npm run prisma:generate`
- Prisma migrate: `npm run prisma:migrate`

## Architecture Boundaries
### Frontend
- App routes and API routes are in `src/app/`.
- AI chat endpoint is `src/app/api/chat/route.ts` (Groq stream + Firebase token verification).
- UI components are organized by domain under `src/components/`.
- Shared client logic is in `src/lib/` and global state in `src/store/useAppStore.ts`.

### Backend
- Actual server framework is Fastify, entry points: `backend/src/index.ts` and `backend/src/app.ts`.
- Route handlers live in `backend/src/routes/`.
- Business logic belongs in `backend/src/services/` (keep routes thin).
- Validation uses Zod schemas (`backend/src/lib/schemas.ts`) at route boundaries.
- Database access goes through Prisma (`backend/prisma/schema.prisma`, `backend/src/lib/db.ts`).

## Conventions Agents Should Follow
- Keep route handlers minimal; put orchestration and domain logic in service files.
- Reuse or extend existing Zod schemas rather than adding ad-hoc validation.
- Preserve existing response envelope patterns (`ok`, `data` or error payload).
- Prefer small, focused changes; avoid broad refactors unless explicitly requested.

## Known Pitfalls
- Some backend docs mention Express, but runtime code is Fastify. Trust source code over stale docs.
- Frontend chat route requires Firebase auth token and `GROQ_API_KEY`; missing env values fail requests.
- Backend requires Node >= 18 and a configured PostgreSQL `DATABASE_URL` for Prisma flows.

## Canonical Docs (Link, Don't Duplicate)
- Project overview: [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)
- Product requirements: [prd.md](prd.md)
- Roadmap: [roadmap.md](roadmap.md)
- Frontend + platform overview: [README.md](README.md)
- Backend setup: [backend/SETUP.md](backend/SETUP.md)
- Backend API details: [backend/API_DOCUMENTATION.md](backend/API_DOCUMENTATION.md)
- Backend implementation notes: [backend/IMPLEMENTATION_SUMMARY.md](backend/IMPLEMENTATION_SUMMARY.md)
- Backend reference README: [backend/README.md](backend/README.md)

## Preferred Verification Before Completion
1. Run lint for the touched project.
2. Run type checks when backend TypeScript files are changed.
3. For backend API changes, run relevant endpoint checks against `/health` or changed routes.
4. Summarize exactly what was validated and what was not run.
