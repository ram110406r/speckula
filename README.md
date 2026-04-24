<div align="center">
  <img src="public/logo.png" alt="Buildcase Logo" width="120" />
  
  <h1>Buildcase</h1>
  <p><strong>The AI-first workspace for product discovery and execution.</strong></p>
  <p><em>Think of it as Cursor — but for Product Managers.</em></p>

  <br />

  ![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
  ![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-orange?style=flat-square&logo=firebase)
  ![Groq](https://img.shields.io/badge/Groq-Llama%203.3%2070B-purple?style=flat-square)
  ![TipTap](https://img.shields.io/badge/TipTap-Editor-teal?style=flat-square)
  ![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

</div>

---

## What is Buildcase?

Buildcase is an **AI-native product intelligence system** — a single, focused environment where product managers go from raw ideas to structured execution without switching tools.

> There is no system that helps product managers go from **raw user signals → product decisions → execution** in a continuous, intelligent workflow. Buildcase is that system.

**Core workflow:**
```
Input  →  Insights  →  Decision  →  PRD  →  Execution Tasks
```

---

## Features

### ✍️ AI Editor
A distraction-free, rich-text editor powered by TipTap. Write product thoughts and let the AI transform them into structured outputs.

### 🤖 Groq-Powered AI Assistant
Real-time streaming intelligence using **Llama 3.3 70B** via Groq's ultra-fast inference API. Ask questions, generate PRDs, extract insights — all without leaving the editor.

### ⚡ One-click Product Shortcuts
- **Generate PRD** — Auto-generate a fully structured Product Requirements Document from your notes.
- **Extract Insights** — Identify pain points, user segments, market opportunities, and differentiators.
- **Suggest Execution Tasks** — Get a prioritized 90-day execution plan directly from your ideas.

### 🔐 Firebase Authentication
Secure Google Sign-In with real-time session management across browser tabs.

### 💾 Auto-Save to Firestore
Everything you write auto-saves to the cloud with a 2-second debounce. No manual save buttons. No lost work.

### 🎨 Retro-Industrial Design System
A carefully crafted aesthetic — Burnt Orange (`#C04A2B`) on Warm Cream (`#F7F4EC`) in light mode, deep charcoal in dark mode. Calm. Structured. Focused.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4, shadcn/ui |
| **Editor** | TipTap (with Placeholder, StarterKit) |
| **AI Provider** | Groq (`llama-3.3-70b-versatile`) |
| **Auth** | Firebase Authentication (Google) |
| **Database** | Cloud Firestore |
| **State** | Zustand |
| **Build** | Webpack (WASM fallback for Windows) |

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- A [Firebase project](https://console.firebase.google.com/) with Authentication and Firestore enabled
- A [Groq API key](https://console.groq.com/)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/buildcase.git
cd buildcase
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
# Firebase (from your Firebase Console → Project Settings → Your apps)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Backend (Fastify service that proxies Groq). Defaults to http://localhost:3001.
BACKEND_URL=http://localhost:3001
```

The `GROQ_API_KEY` now lives on the backend (see `backend/.env.example`), not the
Next.js app. The frontend's `/api/chat` route simply proxies to the backend.

### 4. Set up Firebase

In your Firebase Console:
1. **Authentication** → Enable **Google** as a sign-in provider.
2. **Firestore Database** → Create a database (start in test mode for development).

### 5. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
src/
├── app/
│   ├── api/chat/route.ts       # Groq streaming AI endpoint
│   ├── layout.tsx              # Root layout with AuthProvider
│   └── page.tsx                # Entry point → Shell
│
├── components/
│   ├── ai/
│   │   └── AIPanel.tsx         # Streaming AI chat panel
│   ├── editor/
│   │   ├── Editor.tsx          # Editor toolbar + layout
│   │   └── TipTapEditor.tsx    # Core TipTap instance with auto-save
│   └── layout/
│       ├── Shell.tsx           # 3-column flexbox layout
│       └── SidebarNav.tsx      # Navigation + auth controls
│
├── lib/
│   └── firebase/
│       ├── config.ts           # Firebase initialization
│       ├── AuthProvider.tsx    # React context for auth state
│       └── db.ts               # Firestore document repository
│
└── store/
    └── useAppStore.ts          # Global Zustand state
```

---

## Interface Layout

```
┌──────────────────┬────────────────────────────┬─────────────────────┐
│                  │                            │                     │
│   Sidebar        │    Editor (Main)            │   AI Assistant      │
│   ─────────      │    ─────────────            │   ───────────────   │
│   [Logo]         │    Untitled Document        │   [Generate PRD]    │
│                  │                            │   [Extract Insights]│
│   Editor         │    Start typing your       │   [Suggest Tasks]   │
│   Insights       │    product thoughts...     │                     │
│   PRDs           │                            │   ─────────────── ─ │
│   Tasks          │                            │   Ask Buildcase...  │
│                  │                            │                     │
│   [Sign In]      │                            │                     │
│                  │                            │                     │
└──────────────────┴────────────────────────────┴─────────────────────┘
```

---

## Design Philosophy

Buildcase follows four core principles:

1. **Editor-First** — The entire experience revolves around a single intelligent editor.
2. **AI-Native** — AI is not a feature. It is the core system behavior.
3. **Continuous Workflow** — From raw input to executable tasks, the loop never breaks.
4. **Minimal Interface** — No clutter. No unnecessary dashboards. Maximum focus.

---

## Publish Flow QA

Use these checks for Phase 6 publish activation:

1. **User clicks publish**
  - Generate decisions in the decision engine.
  - Save an expected outcome.
  - Click **Publish Case** from a decision card.
  - Publish with visibility set to `public`.
  - Expected result: the case is visible on `/u/{userId}` immediately and score average updates.

2. **User edits before publish**
  - Open publish modal from a decision card.
  - Edit title and description before publishing.
  - Publish and open `/c/{caseId}`.
  - Expected result: the saved case reflects edited values.

---

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

---

## License

[MIT](LICENSE)

---

<div align="center">
  <strong>Buildcase is not a productivity tool — it is a thinking system for building products.</strong>
</div>
