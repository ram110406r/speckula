# Speckula — Pages & Functions

> One workspace for the full product loop: from raw idea to shipped outcome, graded.

---

## Navigation Structure

The sidebar organizes all pages into six sections:

| Section | Pages |
|---|---|
| **Home** | Workspace, Dashboard |
| **Intelligence** | Editor (Research), Market Intelligence, Competitors, Product Brain |
| **Decision Engine** | Decisions, Specifications (PRDs), Roadmaps, Experiments |
| **Execution** | Tasks, Cases (Projects), Integrations |
| **AI Systems** | Autonomous Mode, Agents, Activity |
| **Platform** | Extension, Notifications, Settings, Profile, Help |

---

## Pages

### Workspace
**Home base for a session.**

- Quick-action buttons: Add Signal, Make Decision, Write Spec, Create Task
- Recent intelligence feed with timestamps across all phases
- Team activity log — who did what and when
- Phase health indicators (Evidence → Decisions → Specs → Tasks) showing completeness
- Stat cards with trend arrows
- One-click shortcuts to jump into any work area

---

### Dashboard
**Central overview of everything happening across the platform.**

- Live rotating activity feed: competitor changes, market trends, AI insights, new decisions, experiment results
- Market signal indicators with up/down momentum
- Active analyses in progress with real-time status
- Recent decisions panel with priority scores
- Competitor activity summaries
- Startup KPI strip across the bottom

---

### Editor (Research)
**Rich-text workspace for raw thinking, notes, and imported content.**

- TipTap rich-text editor with headings, lists, links, inline formatting
- Structured research blocks: Problem, Context, User Pain, Insights, Assumptions
- 2-second debounced auto-save to Firestore — no save button
- Inline AI suggestions via the `InlineSuggestion` overlay, dismissible per block per document
- URL import bar — paste any article URL to extract content directly into the editor
- File drop import, including PDF extraction
- Template picker for common research formats
- Multi-document tree in the sidebar: create, rename, delete, sorted by last updated

---

### Market Intelligence
**Aggregated signals, trends, and opportunities from external sources.**

- Signal feed categorized by type: pain points, complaints, trends, opportunities, product launches
- Sentiment tagging: negative / positive / neutral
- Trend momentum bars showing velocity and direction
- Market gap and opportunity identification widgets
- Source attribution: Reddit, Hacker News, Twitter, review sites
- Urgency classification — filter by what needs action now

---

### Competitors
**Monitor competitors and assess their threat level.**

- Threat-level cards scored high / medium / low
- Real-time pricing tracking across tiers (Starter, Pro, Enterprise)
- Feature set and positioning analysis per competitor
- User complaint and sentiment aggregation (common criticisms)
- Recent change detection with historical update log
- Competitor weakness identification to surface differentiation opportunities
- Side-by-side comparison matrix

---

### Product Brain
**AI-powered knowledge graph of everything learned about the product and market.**

- Searchable memory library with categories: learning, decision, assumption, insight, experiment
- Confidence scores on each memory entry, updated as new evidence arrives
- Tag-based organization across domains: market, product, strategy, competitor, growth
- Connection tracking between related insights (linked memory graph)
- Filter by type, category, or confidence level
- AI synthesis panel — ask a question, get a synthesized answer from the memory store
- SVG sparkline showing confidence evolution over time

---

### Decisions
**Scored product decisions with health evaluation and outcome tracking.**

- Filter by: All, Strong (score ≥ 70), Risky (45–70), Recent
- Grouped by health: Healthy / Needs Validation / Risky
- Each card shows: 0–100 opportunity score, impact / effort / confidence / demand breakdown, priority badge, strategic theme, key insights, risks, tradeoffs
- Case Brief dialog — AI-generated opportunity statement, context, reasoning, and build / delay / validate recommendation
- Score history graph — rolling 12-entry trend chart per decision
- Expected vs. actual outcome: record a pre-launch target metric and post-launch result; triggers a Learning Insight
- Manual decision form: create decisions with title, priority, justification, user story, tradeoffs, scores
- Actions: generate PRD, publish as public case, delete

---

### Specifications (PRDs)
**AI-generated product requirements documents, stored and exportable.**

- PRD list with draft / approved status badges
- Document viewer and inline editor
- Auto-generation from a chosen decision with one click
- Export to Markdown or Word (.docx)
- Copy-to-clipboard
- Source document tracking (links back to the research note it came from)
- Jump-to-tasks button: navigate directly to tasks generated from this PRD

---

### Roadmaps
**Quarter-by-quarter product planning with AI-scored prioritization.**

- Quarter filter: Q2 2026 → Q1 2027
- Item status: in progress / planned / backlog
- AI confidence scoring for each roadmap item
- Dependency chains — items that block or are blocked by others
- Progress bars showing completion percentage per item
- Priority and tag-based filtering
- AI score badges reflect how well each item aligns with current decisions

---

### Experiments
**Manage A/B tests and growth experiments with statistical tracking.**

- Experiment cards: hypothesis, variant definitions, target metric
- Status: running / completed / paused / planned
- Statistical confidence meter and sample size tracker
- Metric comparison: baseline vs. variant result
- Improvement percentage with directional indicator
- AI-generated insight panel interpreting results
- Learning loop: completed experiments feed back into the Product Brain

---

### Tasks
**Execution tracking and kanban board for shipped work.**

- Kanban board view and flat list view, switchable
- Status workflow: To Do → In Progress → Done
- Priority: high / medium / low with color coding
- Category labels: backend, frontend, design, QA, integration, devops
- Due date tracking with overdue indicators
- Drag-and-drop between columns
- AI-generated task suggestions from a PRD (one click to break a spec into a 90-day plan)
- Dependency declarations with reasoning traces
- Assignee management

---

### Cases (Projects)
**Public case portfolio — published decisions with their outcomes attached.**

- Every published decision becomes a permanent record at `/c/{caseId}`
- Reasoning trace, scores, and post-launch outcome travel with the case
- Visibility control: public / private / unlisted
- Publish validation: requires an expected outcome (metric + target + timeframe) before going live
- User profile page at `/u/{userId}` shows all published cases and rolling score average
- Recruiter-optimized read-only layout for public profiles
- Team workspaces: invite members by email, manage roles (owner / editor / viewer), shared decision knowledge base

---

### Integrations (Slack)
**Connect external tools to pipe data into the intelligence loop.**

- Integration marketplace with 8 integrations: GitHub, Slack, Notion, Jira, Figma, PostHog, Mixpanel, Linear
- Status per integration: connected / error / available
- Sync frequency display and last-synced timestamp
- Data points aggregated from each connected source
- Permission and feature configuration per integration
- Activity log for integration events
- Slack-specific: OAuth connect flow, channel browser, message backfill, analyze imported messages

---

### Autonomous Mode
**Multi-step AI reasoning agent that runs an idea through the full product loop.**

- Conversational chat interface with visible thinking state
- Three depth levels:
  - **Quick** — no clarifications, skips roadmap, fastest output
  - **Standard** — one clarifying question, full decision + strategy output
  - **Deep** — two clarifying questions, reflection loop, confidence gate on high-risk decisions
- Outputs: clarifying questions, 3 candidate decisions, strategic guidance, 3-phase roadmap, PROCEED / VALIDATE_FIRST / DO_NOT_BUILD verdict
- Real-time event stream — thinking, questions, decisions, and verdict appear as they are generated
- Past-run memory: stores recent ideas and verdicts in Firestore to avoid repeating weak framings
- Post-run actions: save top decision, convert to Spec (PRD), create Tasks from roadmap
- Stop / Reset: abort mid-run or clear for a fresh analysis

---

### Agents
**Monitor and manage the autonomous AI agents running in the background.**

- Agent list with status: running / idle / scheduled
- Agent type classification: intelligence gathering, synthesis, analysis, delivery
- Current task visibility per agent
- Success rate and uptime metrics
- Execution timeline with timestamped action log
- Historical activity feed — what each agent did and when

---

### Activity
**Audit log of everything that has happened across the workspace.**

- Chronological feed of all events: AI completions, decisions created, specs generated, tasks moved, integrations synced
- Filterable by event type and date range
- Per-event detail panel
- Notification history (mirrors the activity bell in the sidebar)

---

### Extension
**Browser extension management and data capture settings.**

- Extension connection status and version
- Capture configuration: what types of content to capture automatically
- Review queue for extension-captured items before they enter the intelligence loop
- Heartbeat monitoring — confirms the extension is active and syncing

---

### Notifications
**Centralized notification inbox.**

- All system alerts: AI analysis completed, decision health changes, experiment results, integration errors
- Mark as read / dismiss
- Links directly to the relevant item in the workspace

---

### Settings
**Account and workspace configuration.**

- API key management (Groq, integrations)
- Notification preferences
- Data retention configuration
- Workspace member management
- Theme preference (light / dark)

---

### Profile
**Personal profile and published work.**

- Display name, bio, skills
- Opt-in public profile toggle
- Published cases listed with scores
- Rolling decision score average

---

### Help
**Documentation and support resources.**

- Getting started guides per phase (Evidence → Decision → Spec → Tasks)
- Keyboard shortcut reference
- Troubleshooting for common errors
- Link to GitHub issues for bug reports

---

## The Full Loop

```
Write research (Editor)
        ↓
Extract signals (Market Intelligence)
        ↓
Score decisions (Decisions)
        ↓
Generate spec (Specifications)
        ↓
Break into tasks (Tasks)
        ↓
Track on roadmap (Roadmaps)
        ↓
Run experiments (Experiments)
        ↓
Publish case (Cases)
        ↓
Log outcome → Learning Insight → shapes next decision
```

All steps can also be run end-to-end by the **Autonomous Mode** agent in one session.
