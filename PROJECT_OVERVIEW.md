# Buildcase — Product Intelligence Workspace

Buildcase is an AI-native workspace designed for product managers and founders to transform raw ideas into actionable strategy. It bridges the gap between disorganized notes and formal product documentation.

## 🚀 Key Features

### 1. AI-Powered Workspace (The Editor)
- **Fluid Writing Experience**: A sleek, distraction-free TipTap editor designed for product thinking.
- **Auto-Save Persistence**: Real-time syncing to Firestore ensures you never lose a note.
- **Multi-Doc Support**: Manage multiple documents for different projects, features, or user research sessions.

### 2. Structured Intelligence Views
- **💡 Insights Engine**: Extracts user pain points, market patterns, and user segments from your raw notes. Categorizes them automatically for easy filtering.
- **📄 PRD Generator**: One-click transformation of brainstorming notes into a professional Product Requirement Document (Markdown-ready).
- **✅ Execution Tasks**: Suggests prioritized 90-day task lists and milestones based on the context of your current document.

### 3. AI Copilot (The Panel)
- **Context-Aware Assistance**: Chat with the Groq-powered AI model about your document.
- **Action Triggers**: Quickly generate content or get feedback on your ideas in real-time.

### 4. Seamless Onboarding & Security
- **Premium Landing Page**: A sleek entry point for new users highlighting key value propositions.
- **Secure Authentication**: Integrated Google Sign-In via Firebase Auth.
- **User-Scoped Data**: Strict Firestore Security Rules ensure your product strategy remains private and secure.

## 🛠️ Technical Stack
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4.
- **Editor**: TipTap (Headless Framework).
- **Database**: Firebase Firestore (Real-time).
- **Inference**: Groq API (Llama 3 / Mixtral) for ultra-fast structured extractions.
- **State Management**: Zustand (Lightweight Global Store).

## 📂 Project Structure
- `src/components/editor`: Core writing components.
- `src/components/views`: The structured intelligence views (Insights, PRDs, Tasks).
- `src/components/layout`: Shell, Sidebar, and Landing Page.
- `src/lib/ai`: Centralized AI action services and prompt engineering.
- `src/store`: Application state for documents and UI navigation.

---
> [!TIP]
> **Getting Started**: Open the sidebar, create a new document, and start typing your product ideas. Then, switch to the "Insights" view and click **Extract with AI** to see the magic happen!
