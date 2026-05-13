# SPECKULA - Market Intelligence, Competitors & Product Brain Analysis

**Generated:** May 2026  
**Project Status:** Phase 1 Complete → Phase 2 Active (Intelligence & Automation)

---

## Executive Summary

**Speckula** is an AI-native workspace for product intelligence and autonomous decision-making. It positions itself as **"Cursor for Product Managers"** — enabling PMs to go from raw market signals → validated decisions → executable roadmaps without context switching.

**Market Position:**
- **TAM:** ~$12B (product management tools + AI coding platforms)
- **SOM:** ~$500M (collaborative AI-native PM tools for early-stage teams)
- **Target:** Seed → Series B product teams (2-15 PMs) at startups

**Competitive Advantages:**
1. **Editor-first workflow** (vs dashboard-heavy tools)
2. **AI-native** (not bolted-on AI helpers)
3. **Autonomous agent** for multi-step reasoning + decisions
4. **Learning loop**: outcomes → insights → confidence adjustment
5. **Product brain**: centralized knowledge graph (competitors, market signals, insights)

---

## The Speckula Platform: What's Built

### 1. Core Architecture (Phase 1 ✅ Complete)

**Frontend Stack:**
- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS v4 + shadcn/ui design system
- TipTap rich-text editor with AI shortcuts
- Zustand state management
- Firebase Auth + Firestore

**Backend Stack:**
- Fastify (Node.js) API service
- PostgreSQL + Prisma ORM
- Groq (Llama 3.3 70B) for AI inference
- pgvector for semantic search
- BullMQ job queue for async tasks

**3-Column Interface:**
```
Sidebar | Main Editor | AI Assistant Panel
```

### 2. Features Implemented (Phase 1-2)

#### **A. Intelligence Collection**
- ✅ **Extension Analyzer** - Captures web pages (competitors, HN, Product Hunt, etc.)
- ✅ **Job Queue** - BullMQ-based async processing
- ✅ **Competitor Intelligence** - Domain analysis, pricing, UX, GTM strategy
- ✅ **Market Signals** - Trends, competitor moves, customer feedback
- ✅ **Product Brain** - Semantic graph of workspace intelligence (pgvector embeddings)

#### **B. Decision Engine**
- ✅ **AI-Generated Decisions** - Multi-step reasoning with confidence scoring
- ✅ **Decision Reasoning Log** - Full audit trail + confidence sources
- ✅ **Outcome Tracking** - Expected vs actual metrics
- ✅ **Learning Loop** - AI-powered post-outcome analysis

#### **C. Autonomous Agent (14-State)**
- ✅ **Clarification** - Asks clarifying questions
- ✅ **Research** - Analyzes product brain + market signals
- ✅ **Decision Generation** - Proposes 3 candidate strategies
- ✅ **Roadmap Generation** - Quarterly phased execution
- ✅ **Verdict** - PROCEED | VALIDATE_FIRST | DO_NOT_BUILD

#### **D. Workspace & Collaboration**
- ✅ **Workspace Isolation** - Team context boundaries
- ✅ **Activity Feed** - Real-time event stream
- ✅ **Metrics Dashboard** - Signals, decisions, specs, experiments tracked
- ✅ **Role-Based Access** - Owner | Editor | Viewer

#### **E. Experiments & Learning**
- ✅ **A/B Testing Framework** - Variants, conversion tracking, statistical significance
- ✅ **Learning Insights** - Root cause analysis post-experiment
- ✅ **Confidence Feedback Loop** - Adjust decision confidence based on outcomes

### 3. Data Models (Prisma Schema)

**Core Domain Objects:**
```
ProductBrainEntry → CompetitorInsight
                 → MarketSignal
                 → SemanticEmbedding (pgvector)

Workspace → WorkspaceMember
         → WorkspaceContext (competitors, strategy, goals)
         → WorkspaceActivity (event stream)
         → WorkspaceMetrics (rollups)

Experiment → ExperimentVariant (control + N variants)
          → (Outcomes → LearningInsights)

AgentRun → (steps, decisions, roadmap, verdict)

Outcome → LearningInsight (why succeeded/failed)

AnalysisJob → (queued → extracting → classifying → embedding → completed)
```

**AI Output Caching:**
- `AIInsight` - Groq-generated insights
- `AIPRD` - Product requirements docs
- `AISuggestedTask` - Execution tasks
- `PromptCache` - TTL-based dedup cache
- `PromptLog` - Full cost tracking + prompt correlation

---

## Competitive Landscape Analysis

### Market Segments

**1. Traditional PM Tools (Low AI Integration)**
- **Asana, Linear, Jira** - Task/project management
- **Notion, Coda** - Workspace/documentation
- **Amplitude, Mixpanel** - Analytics
- **Weakness:** Context-switching, no decision reasoning

**2. "AI-Powered" PM Tools (Bolt-On AI)**
- **Notion AI, ChatGPT plugins**
- **Weakness:** AI is an afterthought, not core to workflow

**3. AI Coding Copilots (AI-Native)**
- **Cursor (editor-first)** ← inspiration for Speckula positioning
- **GitHub Copilot** - In-IDE assistant
- **Replit Agent** - Full project generation
- **Strength:** Users understand AI-native workflows already

### Direct Competitors (Phase 2-3)

#### **Competitive Set**
1. **Loom (video intelligence for PMs)**
   - Strength: Frictionless idea capture
   - Weakness: No reasoning engine, limited decision support

2. **Superhuman for PMs (doesn't exist yet)**
   - If built: email/notification optimization
   - Opportunity gap: No PM-specific reasoning engine

3. **Claude Projects (Anthropic + OpenAI ChatGPT)**
   - Strength: Powerful LLMs, prompt caching
   - Weakness: No domain models (competitors, markets), no learning loops

4. **Replit Agent / Cursor Extended**
   - Potential: Could expand into PM workflows
   - Risk: Low — domain specificity is defensible

5. **Internal Solutions**
   - Many large teams build custom PM dashboards
   - Speckula TAM = startups that lack engineering for custom tools

### Speckula's Defensibility

| Factor | Speckula | Notion AI | Cursor | Custom |
|--------|----------|-----------|--------|--------|
| **AI-native workflow** | ★★★★★ | ★★☆☆☆ | ★★★★☆ | ★★★★☆ |
| **Domain specificity** | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★★★ |
| **Learning loops** | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ |
| **Collab + multiplayer** | ★★★★☆ | ★★★★★ | ★☆☆☆☆ | ★★★☆☆ |
| **Ease of setup** | ★★★★☆ | ★★★★★ | ★★★☆☆ | ★☆☆☆☆ |

**Defensibility Score: 8.5/10** ← Specific to PM decision-making, not commoditizable.

---

## Market Opportunity

### Total Addressable Market (TAM)

**Bottom-up calculation:**
```
TAM = (Product teams globally) × (% using AI tools) × (ARPU)

Product teams globally (2024 data):
  - ~500k startups (0-10 product roles) × $120 ARPU/PM/year = $60B
  - ~100k mid-market/enterprise (10+ PMs) × $500 ARPU/PM = $50B
  
PM-specific AI tools market (subset):
  - Estimated 15-20% of PMs adopt specialized AI tools = ~$15-20B
  - Speckula TAM (seed → Series B, <10 PMs): ~$3-5B
```

### Serviceable Addressable Market (SAM)

**Speckula's initial target (Phase 3):**
```
TAM × (% reachable) × (% willing to switch)
= $3-5B × 5% penetration = $150-250M SAM
```

**Tier 1 Segment:** Seed/Series A teams (2-8 PMs)
- Pain point: "We don't have time for research + decision analysis"
- Competitive threat: Manual Notion/Airtable + ChatGPT
- Acquisition: Product Hunt, Indie Hackers, Y Combinator
- ARPU: $50-200/month

**Tier 2 Segment:** Series B/C teams (8-20 PMs)
- Pain point: "Decisions are slow, confidence is low, outcomes aren't tracked"
- Competitive threat: Asana, Linear, Productboard
- Acquisition: Sales, partnerships, word-of-mouth
- ARPU: $200-500/month

### Growth Trajectory (Forecast)

| Year | Users | MRR | Phase | Focus |
|------|-------|-----|-------|-------|
| 2026 | 100 | $2k | Beta → Early Adopters | Extension + Competitor AI |
| 2027 | 2.5k | $100k | Product/Market Fit | Autonomous Agent, outcomes loop |
| 2028 | 15k | $1.5M | Scale | Team collab, integrations (Slack, GitHub) |
| 2029 | 50k | $7.5M | Expansion | Enterprise, custom AI models |

---

## Product Brain: Intelligence Architecture

### What Gets Stored (Semantic Knowledge Graph)

**Entry Types (Prisma Model):**
```
competitor_insight   → Pricing, positioning, UX friction, GTM
market_signal        → Trends, funding, new entrants, shifts
pm_insight          → Our strategic thinking, learnings
pricing_observation → Competitor pricing moves, packaging
onboarding_pattern  → User onboarding friction (from extension)
feature_comparison  → Our features vs competitors
strategic_decision  → Recorded decisions + outcomes
ux_friction         → Customer friction points
```

### Vector-Based Retrieval

**pgvector Setup:**
```sql
CREATE TABLE "SemanticEmbedding" (
  id UUID PRIMARY KEY,
  "entryId" UUID UNIQUE,
  model TEXT,        -- e.g. "text-embedding-3-small"
  dims INT,          -- 1536 for OpenAI
  embedding vector(1536)  -- pgvector column
);

-- Similarity search query
SELECT * FROM "ProductBrainEntry"
WHERE "SemanticEmbedding".embedding <-> $1::vector 
ORDER BY embedding <-> $1 LIMIT 10;
```

**Retrieval in Prompts:**
- When making decisions: "Here are 10 similar past observations..."
- When analyzing outcomes: "Root cause analysis from related learnings..."
- When generating roadmaps: "Market context: these competitors are moving toward..."

### Feedback Loops

1. **Extension → Browser → AnalysisJob → ProductBrainEntry**
   - User visits competitor site → Browser extension captures page
   - Backend extracts: pricing, feature list, UX patterns
   - Groq analyzes & classifies entry
   - Embedding stored in pgvector

2. **Decision → Outcome → LearningInsight → ProductBrain**
   - Decision is made with expected metric + timeframe
   - Outcome is recorded (actual vs expected)
   - Groq generates: root cause, actionable next, confidence delta
   - Learning insight is tagged & embedded

3. **Experiment → Variant Results → Statistical Analysis → Learning**
   - A/B test runs
   - Variants report conversions
   - Backend computes: lift, p-value, significance
   - AI explains why variant won

---

## Product Vision: "Cursor for PMs"

### The Analogy

| Cursor | Speckula |
|--------|----------|
| Understand your codebase | Understand your market |
| Suggest code changes | Suggest product decisions |
| Multi-file refactoring | Multi-step reasoning (agent) |
| Real-time inference | Streaming AI responses |
| Always-on context | Always-on competitor context |

### Why This Resonates

1. **Developers get AI-native tools.** PMs use Slack + Notion + Airtable (fragmented).
2. **Cursor shows: developers want AI in their workflow, not a separate chatbot.**
3. **PMs want the same: Intelligence inside the editor, not a tab away.**

### Philosophy

- **Editor-First** — thoughts → insights → decisions → tasks (one flow)
- **AI-Native** — not "use ChatGPT + our UI," but "reasoning engine is the product"
- **Outcome Loops** — measure what actually happened, learn, adjust confidence
- **Minimal Interface** — no dashboards, no clutter, maximum focus

---

## Phase Breakdown & Roadmap

### ✅ Phase 1: Foundation (Complete)
- Editor + Groq streaming
- Firebase Auth + Firestore auto-save
- TipTap + AI shortcuts (Generate PRD, Extract Insights, Suggest Tasks)
- Basic design system

### ✅ Phase 2: Intelligence (In Progress)
- Extension analyzer
- Competitor intelligence scraping
- Market signals collection
- Product brain (semantic graph)
- Outcomes + learning loop
- Autonomous agent (14-state)

### 🔄 Phase 3: Scale (Next)
- Workspace collaboration (multi-user editing, activity feed)
- Integrations (Slack, GitHub, Linear, Jira)
- Custom AI models (fine-tune on workspace data)
- Public profiles + sharing (like `/u/{userId}`)

### ⏳ Phase 4: Enterprise (Future)
- SAML/SSO
- Audit logs + compliance
- SLA + dedicated support
- Custom inference endpoints
- Workspace API for extensions

---

## Strengths, Weaknesses, Opportunities, Threats (SWOT)

### Strengths ✅
1. **AI-native from day 1** — not a retrofit
2. **Domain-specific model** — competitors, market signals, outcomes, learning
3. **Closed-loop** — decisions → outcomes → insights → confidence adjustment
4. **Semantic search** — pgvector finds relevant past context automatically
5. **Founder understanding** — built by PMs for PMs
6. **Groq partnership** — real-time streaming, cost-effective

### Weaknesses ⚠️
1. **Early adoption risk** — "AI for decisions" is still unfamiliar to many PMs
2. **Data chicken-and-egg** — product brain is only valuable with rich competitor data
3. **Competition from giants** — Notion, Coda, Amplitude have distribution
4. **Integration debt** — needs Slack, GitHub, Linear, Jira connectors to compete
5. **Pricing model unclear** — per-PM? Per-workspace? Usage-based?

### Opportunities 🚀
1. **Autonomous agent sells itself** — once it works, viral word-of-mouth
2. **Niche communities** — Y Combinator startups, indie founders communities
3. **Extension network effects** — more users = better competitor intelligence
4. **Vertical expansion** — adapt for GTM managers, investors, consultants
5. **API play** — "intelligence as a service" for other PM tools
6. **Training data moat** — collect decisions + outcomes to fine-tune own LLM

### Threats ⚠️
1. **LLM capabilities collapse cost** — Claude, GPT-4 get cheaper & better
2. **Notion / Coda release AI-agent products** — they have distribution
3. **Anthropic releases "Cursor for PMs"** — internal Claude team builds it
4. **User adoption friction** — "I'm not ready to trust AI decisions"
5. **Data privacy concerns** — "Speckula is analyzing my competitors?"

---

## Go-to-Market Strategy (Recommended)

### Phase 3 GTM (Next 6 months)

**1. Early Adopter Acquisition**
- **Channel:** Product Hunt, Indie Hackers, Twitter @[founder]
- **Messaging:** "The autonomous PM: decisions in 5 minutes, not 5 weeks"
- **Freemium:** 1 free workspace, 5 decision runs/month
- **Target:** 500 beta signups by Q4 2026

**2. Community Building**
- **Y Combinator networking** — exclusive early access for YC companies
- **Notion template marketplace** — pre-built PM templates (leads)
- **Twitter thread strategy** — "Here's how our autonomous agent saved us 20 hours"
- **Content:** Case studies (real Speckula decisions + outcomes)

**3. Integration-First Growth**
- **Slack bot** — "Ask Speckula: what's our next move on pricing?"
- **GitHub integration** — link roadmap items to PRs
- **Linear integration** — roadmap items → tasks
- **Result:** Power users who live in these tools discover Speckula there

### Phase 4 Sales (Year 2)

**Target: Series B PMs ($500/month ARPU)**
- Direct sales to Series A/B founders
- Product-led growth + expansion

---

## Product Brain Features to Prioritize

### Must-Have (Phase 2 Validation)
- [ ] Competitor tracking (pricing, features)
- [ ] Market signal detection (trend alerts)
- [ ] Semantic search (find similar past insights)
- [ ] Outcome feedback loop (measure + learn)

### Should-Have (Phase 3)
- [ ] Collaborative intelligence (shared workspace brain)
- [ ] Slack notifications ("New competitor pricing found")
- [ ] Roadmap prioritization (AI scores based on market context)
- [ ] Learning playbooks (aggregate lessons across decisions)

### Nice-to-Have (Phase 4+)
- [ ] Custom knowledge ingestion (internal docs, customer feedback)
- [ ] Competitive war rooms (team vs team playbooks)
- [ ] Investor-facing intelligence (use Speckula insights to pitch VCs)

---

## Pricing Model (Recommendation)

### Option A: Per-Workspace + Per-Analyst
```
Free:      1 workspace, 5 decision runs/mo, 10 competitor profiles
Starter:   $99/mo — 1 workspace, unlimited runs, 50 profiles, extension
Pro:       $299/mo — 3 workspaces, team collab (3 members), priority support
Enterprise: Custom — unlimited, SAML/SSO, dedicated success
```

### Option B: Usage-Based (Groq tokens)
```
$0.001 per 1k input tokens
$0.003 per 1k output tokens
(Speckula pays Groq $0.0005 and $0.0015 respectively)
Min $50/mo, Max $500/mo
```

**Recommendation:** Option A (predictable revenue for startups, simpler UX).

---

## Competitive Response Scenarios

### If Notion releases "AI Agent for PMs"
- **Speckula's defense:** Domain focus + closed-loop learning
- **Strategy:** Emphasize outcomes/confidence feedback (Notion won't have this)
- **Acquisition:** "Switch from Notion → Speckula for decisions, keep Notion for docs"

### If OpenAI releases GPT-PM Assistant
- **Speckula's defense:** Product brain (competitor data) + workspace isolation
- **Strategy:** Position as "enterprise-ready decision framework" vs "chat plugin"
- **Acquisition:** Target teams that outgrow ChatGPT's context windows

### If LLM inference cost collapses 90%
- **Speckula's defense:** Data moat (decisions + outcomes)
- **Strategy:** Shift to "intelligence marketplace" (sell insights to other PMs)
- **Pricing:** Charge for insights, not inference

---

## Key Metrics to Track (Phase 2-3)

### User Growth
- DAU / MAU / Cohort retention
- Activation rate (first decision within 24h)
- Feature adoption (extension, competitor tracking, autonomous agent)

### AI Quality
- Decision confidence avg (target: 0.75+)
- Outcome accuracy (% of decisions that met/exceeded targets)
- Learning loop efficiency (confidence shift post-outcome)

### Business
- MRR, CAC, LTV, churn
- ARPU growth over time
- NPS, support tickets

### Product Brain
- Competitor profiles tracked (goal: 100+ per workspace by Q4)
- Market signals detected (goal: 10+ per workspace/month)
- Semantic search quality (relevance % of top-10 results)

---

## Conclusion

**Speckula is building a defensible, domain-specific AI product at the intersection of:**
1. Product management (domain expertise)
2. AI-native UX (inspired by Cursor)
3. Closed-loop learning (outcomes inform confidence)
4. Semantic intelligence (product brain = moat)

**If executed well (Phase 3 + 4), Speckula can become the standard AI reasoning tool for product teams — competing with Notion, Asana, and internal solutions.**

**Key bets:**
- Users trust AI-driven decisions (vs hybrid manual+AI)
- Autonomous multi-step reasoning > single-turn ChatGPT
- Outcome feedback loops drive product adoption (learning compounds)
- Startup PM market moves faster than enterprise (TAM is smaller, but GTM is easier)

**Path to $10M ARR: Beta → Product/Market Fit (2027) → Series A → Scale (2028-2029)**

---

*Last Updated: May 13, 2026*
