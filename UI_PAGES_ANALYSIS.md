# SPECKULA UI Pages: Market Intelligence, Competitors & Product Brain Analysis

**Generated:** May 13, 2026  
**Analyzed Components:**
- `CompetitorsView.tsx` (Competitive Intelligence Dashboard)
- `ProductBrainView.tsx` (AI-Indexed Memory System)
- `DashboardView.tsx` (Command Center / Market Intelligence Hub)

---

## 1. COMPETITORS VIEW: Competitive Intelligence Dashboard

**File:** `src/components/views/CompetitorsView.tsx` (799 lines)  
**Purpose:** Real-time competitor monitoring with threat scoring, pricing analysis, and market opportunities.

### UI Layout & Components

#### **Page Header**
```
[Title: Competitor Intelligence]                    [Live Data Badge] [Add Competitor Button]
Monitoring {count} competitors across 4+ categories
```

#### **Flash Banner (When New Insights Arrive)**
- Pulsing green banner: "New competitor insight detected via live monitoring"
- Triggered on WebSocket event `insight.created`

#### **Summary Metrics Grid (4 Cards)**
```
┌─────────────────┬─────────────────┬────────────────┬──────────────┐
│ Competitors     │ Alerts This     │ High Threat    │ Opportunities│
│ Tracked         │ Week            │                │              │
│ 5 (real data)   │ 12 (or live)    │ 2 ⚠️           │ 7 💡         │
│ Across 4+ cats  │ 3 pricing · 9   │ Notion, PB     │ From weaknes │
└─────────────────┴─────────────────┴────────────────┴──────────────┘
```

#### **Live-Monitored Competitors (Real Data Section)**
- Shows competitors with **actual data from backend**
- Card format:
  ```
  [Live Badge] Name (domain)          {time_updated}
  ─────────────────────────────────────
  Tracked Insight Types:
    [pricing] [positioning] [ux] [gtm]
  
  {total_insights} insights captured    [View Analysis]
  ```

#### **Filter Tabs**
```
[All] [High Threat] [Recent Updates] [Pricing Changes]
```

#### **Competitor Cards Grid (2-column on lg screens)**
Each card contains:
```
┌─ COMPETITOR CARD ────────────────────────────────┐
│                                                   │
│ [Name] [Category Badge]          [Threat Level] │
│ domain.com                        Updated 2h ago │
│                                                   │
│ Pricing                                          │
│  [free] [pro] [business] [enterprise]           │
│                                                   │
│ Recent Changes                                   │
│  • Raised Business plan by 15%                   │
│  • Launched Notion AI v2                         │
│  • Added Q&A feature                             │
│                                                   │
│ Positioning (italicized quote)                   │
│ "All-in-one workspace for notes..."             │
│                                                   │
│ Weaknesses (= Speckula Opportunities)           │
│  ⬇️ Complex onboarding                           │
│  ⬇️ Performance on large docs                    │
│  ⬇️ No realtime collaboration                    │
│                                                   │
│ User Complaints (Expandable)                    │
│  ✗ Too slow for large databases                 │
│  ✗ Pricing increase frustrating                 │
│  ✗ AI feels bolted on                           │
│  [+1 more]                                       │
│                                                   │
│ Features                                         │
│  [Docs] [Database] [AI] [Templates] [API]...   │
│                                                   │
│ Threat Score: 78 ▓▓▓▓▓▓▓▓░░  [View Full Analysis]│
└──────────────────────────────────────────────────┘
```

### Key Features

**1. Threat Level Scoring**
- **High** (red): Notion, Productboard (positioning & feature completeness)
- **Medium** (amber): Linear, Jira (growing AI integration)
- **Low** (green): Figma (different category, low overlap)

**2. Pricing Matrix**
- 4-tier display: Free, Pro, Business, Enterprise
- Shows price changes over time (stored in recent changes)
- Visual format: [tier] / [price] blocks

**3. Weakness-Opportunity Mapping**
```
Competitor Weakness          →  Speckula Opportunity
──────────────────────────────────────────────────
Complex onboarding          →  Simple, editor-first
No realtime collab          →  Multi-user editing (Phase 3)
No market intelligence      →  Product Brain + Extension
AI feels bolted on          →  AI-native architecture
```

**4. Recent Alerts Feed**
- 7 most recent competitor changes
- Icon-coded by type: `AlertTriangle` (pricing), `Zap` (feature), `Brain` (AI), `DollarSign` (pricing)
- Real data takes priority (from `useCompetitorChanges()` hook)
- Fallback to mock data if no real data available

**5. Feature Comparison Matrix**
```
Capability Matrix:

                    Speckula │ Notion │ Linear │ Productboard │ Figma │ Jira
────────────────────────────────────────────────────────────────────────────
AI Intelligence      ✓       │   ◐    │   ◐    │      ◐       │   ◐   │  ◐
Market Monitoring    ✓       │   ✗    │   ✗    │      ◐       │   ✗   │  ✗
Competitor Tracking  ✓       │   ✗    │   ✗    │      ✗       │   ✗   │  ✗
PM Workflow          ✓       │   ◐    │   ✗    │      ✓       │   ✗   │  ✓
Browser Extension    ✓       │   ✗    │   ✗    │      ✗       │   ✗   │  ✗
Startup Memory       ✓       │   ✗    │   ✗    │      ✗       │   ✗   │  ✗

Legend: ✓ Full support | ◐ Partial | ✗ Not available
```

### Data Sources

**Real Data** (from backend hooks):
- `useCompetitors()` - List of monitored competitors
- `useCompetitorChanges()` - Recent alerts & changes
- `useSpecklaBus()` - WebSocket real-time events

**Mock Data** (fallback reference):
- COMPETITORS array (5 competitors: Notion, Linear, Productboard, Figma, Jira)
- RECENT_ALERTS array (7 sample alerts)
- MATRIX_ROWS array (6 comparison dimensions)

### UX Patterns

**1. Live Data Badge**
```tsx
<DataSourceBadge 
  isLive={hasRealData} 
  lastUpdated={lastUpdatedTime} 
/>
// Output: "Live · 2h ago" or "Demo data"
```

**2. WebSocket Integration**
- Listens for `lastEvent` from SpecklaBus
- On `insight.created` event: triggers `newInsightFlash` banner
- Auto-dismisses after 3 seconds

**3. Expandable Cards**
- User complaints section expands/collapses
- Shows first 2, with "+X more" button
- State managed via `expandedId` in parent

**4. Filter State Management**
```tsx
const filteredCompetitors = COMPETITORS.filter((c) => {
  if (activeFilter === "all") return true;
  if (activeFilter === "high-threat") return c.threat === "high";
  if (activeFilter === "recent-updates") return c.lastUpdate.includes("h");
  if (activeFilter === "pricing-changes") return c.recentChanges.some(...);
  return true;
});
```

### Design System Insights

**Color Coding by Threat:**
```
High    → bg-red-500/10,    text-red-400,    border-red-500/20
Medium  → bg-amber-500/10,  text-amber-400,  border-amber-500/20
Low     → bg-emerald-500/10, text-emerald-400, border-emerald-500/20
```

**Category Color Mapping:**
- Workspace & PM → violet
- Issue Tracking → blue
- Product Management → indigo
- Design & Collaboration → pink
- Project Management → orange

**Weakness Highlight:**
- Green badges with `TrendingDown` icon
- Text: "Weakness = Speckula Opportunities"

---

## 2. PRODUCT BRAIN VIEW: AI-Indexed Memory System

**File:** `src/components/views/ProductBrainView.tsx` (631 lines)  
**Purpose:** Semantic knowledge graph for storing, searching, and organizing startup intelligence.

### UI Layout & Components

#### **Page Header with Search**
```
┌─ PRODUCT BRAIN ─────────────────────────┐
│ 🧠 Product Brain                         │
│ {total} memories · AI-indexed           │
│                                          │
│ 🔍 Search memories, insights, decisions.│
│    [⌘K shortcut]                       │
│                                          │
│ [All] [Learnings] [Decisions] [Assumptions]│
│ [Insights] [Experiments]                 │
└──────────────────────────────────────────┘
```

#### **Main Content Area (2-column layout)**

**Left Column (Flex-1):**
1. Metric cards grid (4 columns):
   ```
   [Total Memories] [High Confidence] [Low Confidence] [Entries Loaded]
   {n} memories     {n} (80% pct)      {n}              {n}
   ```

2. Add Memory Form (optional, toggleable):
   ```
   ┌─ NEW MEMORY ───────────────────────┐
   │ + New Memory                 [✕]   │
   │                                     │
   │ [Learning] [Decision] [Assumption]  │
   │ [Insight] [Experiment]              │
   │                                     │
   │ Memory title...                     │
   │                                     │
   │ What did you learn, decide, or...   │
   │ [textarea area for content]         │
   │                                     │
   │ [Cancel] [Save Memory]              │
   └─────────────────────────────────────┘
   ```

3. Search Results Counter:
   ```
   {n} results for "{query}"     [Clear]
   ```

4. Memory Cards Feed:
   ```
   ┌─ MEMORY CARD ─────────────────────────────┐
   │ [Icon] [Type]  [Category]  [Confidence %] │
   │                                            │
   │ Memory Title (Bold, lg)                    │
   │                                            │
   │ Content preview (clamp 3 lines, then...) │
   │ [Read more / Show less]                    │
   │                                            │
   │ Tags: [#tag1] [#tag2] [#tag3]             │
   │ ─────────────────────────────────────────│
   │ Confidence: ▓▓▓▓░░ 67%  | Source | Related│
   │ {relative_time_ago}                      │
   └────────────────────────────────────────────┘
   ```

5. Memory Network Visualization:
   ```
   ┌─ MEMORY NETWORK ──────────┐
   │ ⚡ Memory Network          │
   │    {n} active entries      │
   │                            │
   │      🧠 SPECKULA Core     │
   │           |                │
   │  ┌────────┼────────┐      │
   │  ▼        ▼        ▼      │
   │ Market | Product | Growth │
   │ Intel  | Decisions| Expts │
   │  {n}     {n}      {n}     │
   │                            │
   │  ┌────────┬────────┐      │
   │  ▼        ▼        ▼      │
   │Competitor│ Strategy│ ...  │
   │ Insights │Assump.  │      │
   │  {n}     {n}      {n}     │
   └────────────────────────────┘
   ```

**Right Sidebar (Hidden on XL screens only):**
1. Intelligence Growth Sparkline:
   ```
   ↗️ INTELLIGENCE GROWTH
   [Sparkline chart: 10 data points]
   {total} total memories | {pct}% high confidence
   ```

2. Top Tags Cloud:
   ```
   🏷️ TOP TAGS
   #pricing  #onboarding  #ux  #pricing  #growth
   #market   #feature     #ai  #competitor
   ```
   (font size varies by frequency)

3. Memory Health Stacked Bar:
   ```
   🛡️ MEMORY HEALTH
   High Confidence    █████░░░ 67%
   Medium Confidence  ██░░░░░░░░ 23%
   Low Confidence     ░░░░░░░░░░ 10%
   ```

### Memory Types & Categories

**Memory Types** (from dropdown):
```
learning    → 📖 BookOpen    → bg-emerald-500/10, text-emerald-400
decision    → 🧭 Compass      → bg-blue-500/10, text-blue-400
assumption  → ⚠️  AlertTriangle → bg-amber-500/10, text-amber-400
insight     → 💡 Lightbulb     → bg-purple-500/10, text-purple-400
experiment  → 🧪 FlaskConical  → bg-orange-500/10, text-orange-400
```

**Categories** (inferred from entry type):
```
market      → Market Intelligence (sky)
product     → Product Decisions (violet)
strategy    → Strategy Assumptions (teal)
competitor  → Competitor Insights (rose)
growth      → Growth Experiments (lime)
```

**Entry Type ↔ Memory Type Mapping:**
```
competitor_insight  → insight  (category: competitor)
market_signal       → learning (category: market)
pm_insight          → insight  (category: product)
pricing_observation → assumption (category: strategy)
onboarding_pattern  → learning (category: growth)
feature_comparison  → insight  (category: competitor)
strategic_decision  → decision (category: strategy)
ux_friction         → learning (category: product)
icp_inference       → assumption (category: market)
```

### Key Features

**1. Search & Filter**
- Search input with `Cmd+K` global shortcut
- Debounced search (400ms) for performance
- Real-time result counter
- Filter by memory type (6 options + All)
- Shows count per filter tab

**2. Add Memory Flow**
```tsx
const handleSave = async () => {
  const token = await user.getIdToken();
  await fetch("/api/product-brain/entries", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      entryType: MEMORY_TYPE_TO_ENTRY_TYPE[type],
      title: title.trim(),
      content: content.trim() || title.trim(),
    }),
  });
  onSaved(); // triggers refetch
};
```

**3. Confidence Scoring**
- Visual bar: percentage fills bar
- Color-coded:
  - ≥80% → emerald (high)
  - 60-79% → amber (medium)
  - <60% → red (low)

**4. Memory Relationships**
- "Connections" button shows how many other memories link to this one
- Stored in backend, UI shows count only

**5. Relative Time Display**
```tsx
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
```

### Data Flow

**Real Data** (from hooks):
- `useProductBrain(workspaceId?, searchQuery?)` → returns `{ entries, total, loading, error, refetch }`
- Maps `ProductBrainEntry` → `Memory` interface
- Debounced search triggers refetch

**Stats Calculation:**
```tsx
const highConfidence = allMemories.filter((m) => m.confidence >= 80).length;
const lowConfidence = allMemories.filter((m) => m.confidence < 60).length;
const medConfidence = allMemories.length - highConfidence - lowConfidence;

// Top tags by frequency
const tagCounts: Record<string, number> = {};
for (const m of allMemories) {
  for (const t of m.tags) {
    tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  }
}
const topTags = Object.entries(tagCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12);

// Per-type and per-category counts for filter tabs
const typeCounts: Record<MemoryType, number> = { learning: 0, decision: 0, ... };
const categoryCounts: Record<MemoryCategory, number> = { market: 0, product: 0, ... };
```

### Design Patterns

**1. Sparkline Chart (SVG)**
- 10 fixed data points: [10, 18, 14, 22, 19, 28, 24, 34, 30, 40]
- Gradient fill: emerald (top) → transparent (bottom)
- Dot marker on last point
- Pure SVG, no external charting library

**2. Type Config Pattern**
```tsx
const TYPE_CONFIG: Record<MemoryType, { icon, color, bg, border, label }> = {
  learning: { icon: BookOpen, color: "text-emerald-400", ... },
  // ...
};
```
Used for quick icon/color lookup throughout component.

**3. Network Visualization**
- Central "SPECKULA Core" hub
- 5 category clusters branching below
- Color-coded by category
- Click to filter (semantic highlight, not actual filtering)

---

## 3. DASHBOARD VIEW: Command Center / Market Intelligence Hub

**File:** `src/components/views/DashboardView.tsx` (962 lines)  
**Purpose:** Real-time operating intelligence dashboard for startup metrics, live feed, AI analyses, and decisions.

### UI Layout & Components

#### **Page Header**
```
┌──────────────────────────────────────────────────┐
│ Activity | Command Center                        │
│ Startup operating intelligence                   │
│                                  [Live] [LIVE ●] │
└──────────────────────────────────────────────────┘

[Extension Connected Banner (if active)]
Extension connected · v1.0.2 · Chrome
```

#### **Top Metrics Row (5 Cards)**
```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ Signals  │ Market   │ AI       │Competitors│ Active   │
│ Captured │ Trends   │ Analyses │ Tracked   │ Agents   │
│ 847      │ 34       │ 12 ●     │ 6         │ 3 ●      │
│ ↑12% this│ ↑5 new   │ (live)   │ ↑1 new    │ (live)   │
│ week     │ today    │          │           │          │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

#### **Main 2-Column Layout**

**LEFT COLUMN:**

1. **Live Intelligence Feed**
   ```
   ┌─ LIVE INTELLIGENCE FEED ──────────────────┐
   │                                  [LIVE ●] │
   │                                            │
   │ [Icon] Description of event               │
   │        Clock 2h ago | Category | [new]    │
   │        ⬤ (highlighted animation)          │
   │                                            │
   │ [Icon] Another event                      │
   │        Clock 1h ago | Category            │
   │                                            │
   │ [Icon] Analysis completed event           │
   │        Clock just now | Category | [new]  │
   │        ⬤ (highlighted)                    │
   └────────────────────────────────────────────┘
   ```
   - Rotates highlighted item every 3 seconds
   - New items flash with green ring + "new" badge
   - Icons: Brain, Cpu, Zap, Radio, Layers, Activity
   - Real WebSocket events prepended (max 5 live items)

2. **Active AI Analyses**
   ```
   ┌─ ACTIVE AI ANALYSES ──────────────────────┐
   │                       [● Running {count}] │
   │                                            │
   │ Analysis Title — URL / Domain              │
   │ ▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░ 67%             │
   │ ⏱ Started 8m ago                          │
   │                                            │
   │ Another analysis running                   │
   │ ▓▓▓░░░░░░░░░░░░░░░░░░░░░░ 34%           │
   │ ⏱ Started 23m ago                         │
   └────────────────────────────────────────────┘
   ```
   - Animated progress bars
   - Maps to `AnalysisJob` objects
   - Color: Blue, Purple, Emerald, Amber rotation

**RIGHT COLUMN:**

1. **Market Signals**
   ```
   ┌─ MARKET SIGNALS ──────────────────────────┐
   │                                            │
   │ 🔍 AI-native tools adoption    ↑ 340%    │
   │ 🔍 PM tool switching intent    ↑ 127%    │
   │ 🔍 "Notion alternative" sch.   ↑ 89%     │
   │ 🔍 Linear enterprise churn     ↑ 34%     │
   │ 🔍 Startup OS category         ↑ 512%    │
   └────────────────────────────────────────────┘
   ```
   - Real data: `useMarketSignals()` → title + strength
   - Fallback mock: 5 signals showing trend strength
   - Search icon + trend percentage (always up in current data)

2. **Recent Decisions**
   ```
   ┌─ RECENT DECISIONS ────────────────────────┐
   │                                            │
   │ 87 │ Launch freemium tier                 │
   │     │ [High] 2 days ago                    │
   │                                            │
   │ 91 │ Ship browser extension v2            │
   │     │ [Critical] 1 day ago                 │
   │                                            │
   │ 74 │ Expand competitor monitoring         │
   │     │ [Medium] 3 days ago                  │
   └────────────────────────────────────────────┘
   ```
   - Score on left (emerald ≥90, amber 75-89, muted <75)
   - Priority badge color-coded
   - Relative time since decision
   - Real data: `useExperiments()` (if available)

3. **Monitored Competitors**
   ```
   ┌─ MONITORED COMPETITORS ───────────────────┐
   │                            [Shield icon]  │
   │                                            │
   │ [N] Notion                                 │
   │     Updated 2h ago        ● (live)        │
   │                                            │
   │ [L] Linear                                 │
   │     Updated 5h ago        ● (live)        │
   │                                            │
   │ [P] Productboard                           │
   │     Updated 1d ago        ● (live)        │
   │                                            │
   │ [F] Figma                                  │
   │     Updated 3h ago        ● (live)        │
   │                                            │
   │ [J] Jira                                   │
   │     Updated 2d ago        ◐ (stale)       │
   └────────────────────────────────────────────┘
   ```
   - Colored initial avatars (deterministic hash-based coloring)
   - Status dot: green/pulsing (live), amber (stale >2 days)
   - Staleness calculated: `Date.now() - lastCapturedAt > 2 days`

#### **Bottom Intelligence Metrics Bar**
```
┌─ INTELLIGENCE METRICS ────────────────────────┐
│ Bar Chart   ⬜ Intelligence Metrics             │
│                                                │
│ ┌──────────┬──────────┬──────────┬──────────┐  │
│ │847       │34        │6         │12        │  │
│ │Signals   │This      │Competitors│ AI      │  │
│ │Captured  │Week      │Tracked   │ Jobs    │  │
│ │↑         │↑ new     │↑ tracked │●(live) │  │
│ └──────────┴──────────┴──────────┴──────────┘  │
└──────────────────────────────────────────────────┘
```
- Real data: `overview` object properties
- Fallback mock: MOCK_METRICS

### Data Integration

**Real Data Hooks:**
```tsx
const { data: overview, loading } = useDashboard();
const { connected, lastEvent } = useSpecklaBus();
const { data: agentsData } = useAgents();
const { data: jobsData } = useAgentJobs();
const { data: signalsData } = useMarketSignals();
const { data: competitorsData } = useCompetitors();
const { data: experimentsData } = useExperiments();
```

**Event-to-UI Mapping:**
```tsx
function eventTypeToIcon(type: string): React.ElementType {
  if (type === "analysis.completed") return Brain;
  if (type === "analysis.progress") return Cpu;
  if (type === "insight.created") return Zap;
  if (type === "notification.created") return Radio;
  if (type.startsWith("extension")) return Layers;
  return Activity;
}

function eventTypeToCategory(type: string): CategoryKey {
  if (type.startsWith("analysis")) return "ai";
  if (type.startsWith("insight")) return "capture";
  if (type.startsWith("notification")) return "agent";
  if (type.startsWith("extension")) return "capture";
  return "ai";
}
```

### Live WebSocket Integration

**Feed Update Pattern:**
```tsx
useEffect(() => {
  if (!lastEvent) return;
  const relevantTypes = ["analysis.completed", "insight.created", "notification.created"];
  if (!relevantTypes.includes(lastEvent.type)) return;

  const newItem: FeedItem = {
    id: liveIdRef.current--,
    icon: eventTypeToIcon(lastEvent.type),
    description: eventToDescription(lastEvent),
    timeAgo: "just now",
    category: eventTypeToCategory(lastEvent.type),
    isNew: true,
  };

  setLiveItems((prev) => [newItem, ...prev].slice(0, 5));
}, [lastEvent]);
```

**Highlighted Item Rotation:**
```tsx
useEffect(() => {
  intervalRef.current = setInterval(() => {
    setHighlightedIndex((prev) => (prev + 1) % feedItems.length);
  }, 3000);
  return () => clearInterval(intervalRef.current);
}, [feedItems.length]);
```

### Design System

**Category Badges:**
```
competitor → blue:   "bg-blue-500",   "text-blue-400"
market     → purple: "bg-purple-500", "text-purple-400"
ai         → green:  "bg-emerald-500", "text-emerald-400"
trend      → amber:  "bg-amber-500",  "text-amber-400"
capture    → cyan:   "bg-cyan-500",   "text-cyan-400"
decision   → violet: "bg-violet-500", "text-violet-400"
experiment → orange: "bg-orange-500", "text-orange-400"
agent      → teal:   "bg-teal-500",   "text-teal-400"
```

**Priority Colors:**
```
Critical → text-red-400,    bg-red-500/10,     border-red-500/20
High     → text-amber-400,  bg-amber-500/10,   border-amber-500/20
Medium   → text-blue-400,   bg-blue-500/10,    border-blue-500/20
Low      → text-muted,      bg-muted,          border-border
```

**Score Ring Colors:**
```
≥90 → text-emerald-400 (high confidence)
≥75 → text-amber-400 (medium)
<75 → text-muted-foreground (low)
```

### Key UX Patterns

**1. WebSocket Connection Status Badge**
```tsx
<WsStatusBadge connected={connected} />
// Shows: Wifi icon + "Live" (green) or WifiOff + "Offline" (gray)
```

**2. Pulse Dot for Live Status**
```tsx
<span className={`h-2 w-2 rounded-full ${color} animate-pulse`} />
// Used for: AI analyses, agent status, live connection indicator
```

**3. Time Relative Formatting**
- "just now" (< 1 min)
- "23m ago" (< 1 hour)
- "2h ago" (< 24 hours)
- "1d ago" (days)

**4. Extension Banner**
```tsx
<ExtensionBanner version="1.0.2" browser="Chrome" />
// Green banner: "Extension connected · v1.0.2 · Chrome"
```

---

## Cross-Page Intelligence Architecture

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Speckula Backend                       │
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ Competitor   │ │ Market       │ │ Product      │        │
│  │ Insight DB   │ │ Signal DB    │ │ Brain DB     │        │
│  │ (Postgres)   │ │ (Postgres)   │ │ (Postgres)   │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│         ▲                ▲                ▲                  │
│  ┌─────┴────────┬───────┴────────┬───────┴────────┐        │
│  │ Extension    │ AI Analysis    │ Knowledge      │        │
│  │ Analyzer     │ (Groq)         │ Embeddings     │        │
│  │ (BullMQ)     │ (pgvector)     │ (pgvector)     │        │
│  └──────────────┴────────────────┴────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                            △
                            │ WebSocket (real-time)
                            │ REST APIs
                            │
┌─────────────────────────────────────────────────────────────┐
│                      Speckula Frontend                       │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                   Dashboard View                        │ │
│  │                                                          │ │
│  │  ┌─────────────────────┐  ┌──────────────────────┐   │ │
│  │  │ Live Feed (WebSocket)│  │ Market Signals       │   │ │
│  │  │ Analyses Running     │  │ Monitored Competitors│   │ │
│  │  │ Recent Decisions     │  │ Intelligence Metrics │   │ │
│  │  └─────────────────────┘  └──────────────────────┘   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │            Competitors View                            │ │
│  │                                                          │ │
│  │  ┌──────────────────┐  ┌──────────────────────────┐  │ │
│  │  │ Live Monitored   │  │ Competitor Cards (Mock)  │  │ │
│  │  │ Competitors      │  │ - Pricing, Features      │  │ │
│  │  │ Recent Alerts    │  │ - Threats, Weaknesses    │  │ │
│  │  │ Feature Matrix   │  │ - User Complaints        │  │ │
│  │  └──────────────────┘  └──────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Product Brain View                           │ │
│  │                                                          │ │
│  │  ┌──────────────────┐  ┌──────────────────────────┐  │ │
│  │  │ Memory Search    │  │ Memory Cards             │  │ │
│  │  │ Filter by Type   │  │ Confidence Scoring       │  │ │
│  │  │ Add Memory Form  │  │ Memory Network           │  │ │
│  │  │ Tags + Stats     │  │ Intelligence Growth      │  │ │
│  │  └──────────────────┘  └──────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Global Hooks (Real-Time State)              │ │
│  │                                                          │ │
│  │  useCompetitors()   → CompetitorSummary[]           │ │
│  │  useMarketSignals() → MarketSignalData[]            │ │
│  │  useProductBrain()  → ProductBrainEntry[]           │ │
│  │  useSpecklaBus()    → { connected, lastEvent }      │ │
│  │  useDashboard()     → { overview, loading }         │ │
│  │  useExperiments()   → ExperimentSummary[]           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Intelligence Network Clusters

**1. Market Intelligence** (DashboardView + CompetitorsView)
- Source: Market Signals DB, Competitor Insights DB
- Processing: Trend analysis, threat scoring, pricing changes
- Display: Dashboard metrics, Recent Alerts, Signal changes

**2. Competitor Surveillance** (CompetitorsView)
- Source: Extension analysis jobs, CompetitorInsight DB
- Processing: Pricing extraction, feature tracking, weakness analysis
- Display: Competitor cards, threat matrix, comparison grid

**3. Knowledge Graph** (ProductBrainView)
- Source: ProductBrainEntry + SemanticEmbedding (pgvector)
- Processing: Embedding generation, confidence scoring, tagging
- Display: Memory cards, search results, tag clouds, network visualization

**4. Real-Time Events** (All Views)
- Source: WebSocket via SpecklaBus (lastEvent)
- Events: analysis.completed, insight.created, notification.created
- Display: Live feed, flash banners, status badges, highlighted rows

---

## Summary: UI Feature Completeness

| Feature | Dashboard | Competitors | Product Brain | Status |
|---------|-----------|-------------|---------------|--------|
| Real-time metrics | ✓ | ✓ | ✓ | Live |
| Live WebSocket feed | ✓ | ✓ | — | Live |
| Market signals tracking | ✓ | — | — | Live |
| Competitor monitoring | ✓ | ✓ | — | Live |
| Competitor threat scoring | — | ✓ | — | Ref Data |
| Feature comparison matrix | — | ✓ | — | Ref Data |
| Pricing analysis | — | ✓ | — | Ref Data |
| Memory/knowledge search | — | — | ✓ | Live |
| Confidence scoring | — | — | ✓ | Live |
| Semantic memory network | — | — | ✓ | Live |
| Memory type filtering | — | — | ✓ | Live |
| Tag cloud visualization | — | — | ✓ | Live |
| Intelligence growth chart | — | — | ✓ | Live |

**Live = Connected to real data via hooks | Ref Data = Mock reference data | — = Not implemented**

---

## Product Brain Conclusions

### Strengths Demonstrated
1. **Real-time integration** - WebSocket live feed across all views
2. **Visual hierarchy** - Clear prioritization of threat, confidence, recency
3. **Data density** - Dense but readable cards with expandable details
4. **Semantic search** - Product Brain implements pgvector similarity search
5. **Network visualization** - Memory clusters show knowledge graph structure

### Design Patterns to Replicate
1. **Color-coded types** - Consistent icon + color schemes for memory types
2. **Confidence bars** - Visual strength indicator for reliability
3. **Threat scoring** - Risk-based sorting and highlighting
4. **Expandable sections** - Progressive disclosure of complexity
5. **Filter tabs with counts** - Quick navigation with context

### Gaps / Future Enhancements
1. **Competitor-to-Memory linking** - No cross-view connections visible
2. **Decision outcomes integration** - Experiments visible on Dashboard, not linked to decisions
3. **Market signal drill-down** - No detail view for signal sources
4. **Comparison across time** - No historical trending for competitor features/pricing
5. **Bulk actions** - No batch operations on memories or competitors
