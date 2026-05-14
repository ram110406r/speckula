<div align="center">
  <img src="public/favicon.png" alt="Speckula" width="80" />

  <h1>Speckula</h1>
  <p><strong>AI-powered product intelligence for product teams.</strong></p>
  <p>From raw user signals to structured execution — without switching tools.</p>

  <br />

  ![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
  ![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss)
  ![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-orange?style=flat-square&logo=firebase)
  ![Groq](https://img.shields.io/badge/Groq-Llama%203.3%2070B-purple?style=flat-square)
  ![Fastify](https://img.shields.io/badge/Fastify-Backend-black?style=flat-square&logo=fastify)
  ![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

</div>

---

## What is Speckula?

Speckula is an **AI-native product intelligence workspace** — a single environment where product managers go from raw user signals to structured decisions and execution without switching tools.

```
User Signals  →  Product Brain  →  Decision Engine  →  PRD  →  Execution Tasks
```

It combines a living knowledge graph of your product with AI-assisted analysis, decision scoring, roadmap generation, and competitor monitoring — all in one place.

---

## Features

### Signal Intelligence
Paste transcripts, survey responses, or Slack messages. Speckula automatically surfaces ranked pain points, opportunities, user segments, and patterns.

### Product Brain
A persistent knowledge graph of your product, users, and market context. Every insight, decision, and document is linked — so the AI always knows your history.

### Decision Engine
Score strategic options against your goals and evidence. Every decision is traceable with justification, impact/effort scoring, and a full case brief.

### PRD Generator
Generate full Product Requirements Documents — executive summary, problem statement, user stories, acceptance criteria, edge cases — in under 60 seconds.

### Roadmap Builder
Turn prioritised decisions into a 90-day roadmap with sprint milestones and a 1-click export.

### Competitor Monitor
Track competitor product changes and feature launches. Alerts surface before they become relevant.

### Slack Integration
Connect your Slack workspace to ingest message history as signals, receive weekly digests, and get alerts for decisions and competitor activity.

### Autonomous Mode
A 14-stage AI agent that runs continuous market monitoring, synthesis, and signal extraction — without manual prompting.

### AI Editor
A distraction-free rich-text editor (TipTap) with inline AI assistance. Write product thoughts and let the AI transform them into structured outputs.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), TypeScript 5 |
| **Styling** | Tailwind CSS v4 (CSS-first config), shadcn/ui |
| **Editor** | TipTap (StarterKit, Placeholder) |
| **Backend** | Fastify, TypeScript, Prisma ORM |
| **Database** | PostgreSQL (Neon) + Cloud Firestore |
| **Job Queue** | BullMQ + Redis |
| **AI** | Groq (`llama-3.3-70b-versatile`) |
| **Auth** | Firebase Authentication (Google) |
| **Real-time** | Firestore subscriptions |
| **Integrations** | Slack OAuth + Events API |
| **Email** | Resend |
| **Observability** | Sentry (frontend + backend) |
| **State** | Zustand |

---

## Project Structure

```
speckula/
├── src/                          # Next.js frontend
│   ├── app/
│   │   ├── api/                  # Next.js route handlers (proxy to backend)
│   │   │   ├── chat/             # AI streaming endpoint
│   │   │   ├── slack/            # Slack OAuth proxy
│   │   │   └── workspaces/       # Workspace API proxy
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ai/                   # AI panel + streaming
│   │   ├── editor/               # TipTap editor
│   │   ├── layout/               # Shell, Sidebar, LandingPage
│   │   └── views/                # All feature views (10+)
│   ├── hooks/                    # useApi, useExtensionPreferences, etc.
│   ├── lib/
│   │   ├── firebase/             # Auth, Firestore repository, AuthProvider
│   │   └── ai/                   # AI action helpers
│   └── store/                    # Zustand stores (app state, toast)
│
├── backend/                      # Fastify API server
│   ├── src/
│   │   ├── routes/               # workspaces, slack OAuth, slack events, AI
│   │   ├── lib/                  # Firebase Admin, Groq client, token crypto
│   │   └── workers/              # BullMQ analysis workers
│   └── prisma/                   # Schema + migrations
│
└── public/                       # Static assets
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- PostgreSQL database (local or [Neon](https://neon.tech))
- Redis (local or managed — required for job queue)
- [Firebase project](https://console.firebase.google.com/) with Auth + Firestore enabled
- [Groq API key](https://console.groq.com/)

---

### 1. Clone the repository

```bash
git clone https://github.com/your-username/speckula.git
cd speckula
```

### 2. Install dependencies

```bash
# Frontend
npm install

# Backend
cd backend && npm install
```

### 3. Configure environment variables

**Frontend** — create `.env.local` in the project root:

```env
# Firebase (from Firebase Console → Project Settings → Your apps)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Backend URL (defaults to http://localhost:3001)
BACKEND_URL=http://localhost:3001

# Optional: Sentry DSN for frontend error tracking
NEXT_PUBLIC_SENTRY_DSN=
```

**Backend** — copy `backend/.env.example` to `backend/.env` and fill in the values:

```bash
cp backend/.env.example backend/.env
```

Key variables to set:
- `DATABASE_URL` — PostgreSQL connection string
- `GROQ_API_KEY` — from [console.groq.com](https://console.groq.com)
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — from your Firebase service account
- `REDIS_URL` — Redis connection string

See `backend/.env.example` for the full list with descriptions.

### 4. Set up Firebase

In your Firebase Console:
1. **Authentication** → Enable **Google** as a sign-in provider.
2. **Firestore Database** → Create a database (start in test mode for development).
3. **Firestore Rules** → Deploy the rules from `firestore.rules` if present.

### 5. Run database migrations

```bash
cd backend
npx prisma migrate deploy
```

### 6. Start the development servers

```bash
# Terminal 1 — Frontend (port 3000)
npm run dev

# Terminal 2 — Backend (port 3001)
cd backend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Slack Integration (Optional)

To enable Slack signal ingestion:

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps).
2. Enable **Bot Token Scopes**: `channels:history`, `channels:read`, `groups:history`, `groups:read`, `chat:write`, `team:read`, `users:read`.
3. Enable **Event Subscriptions** and point the request URL to `https://your-backend/slack/events`.
4. Set the OAuth Redirect URL to `https://your-backend/auth/slack/callback` (or your proxy endpoint).
5. Fill in `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI`, `SLACK_SIGNING_SECRET`, and `SLACK_TOKEN_ENCRYPTION_KEY` in `backend/.env`.

---

## Deployment

Speckula is designed to run as two separate services:

| Service | Suggested platform |
|---|---|
| Frontend (`/`) | Vercel, Cloudflare Pages |
| Backend (`/backend`) | Railway, Fly.io, Docker |
| PostgreSQL | Neon, Supabase, Railway |
| Redis | Upstash, Railway |

Set `FRONTEND_URL` (or `FRONTEND_URLS`) on the backend to your deployed frontend origin so CORS and OAuth redirects work correctly.

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change or add.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit your changes
4. Open a pull request

---

## License

[MIT](LICENSE)

---

<div align="center">
  <strong>Speckula — build the right product.</strong>
</div>
