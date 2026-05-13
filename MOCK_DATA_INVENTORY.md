# SPECKULA Frontend: Complete Mock Data Analysis

**Analysis Date:** May 13, 2026  
**Scope:** `e:\SPECKULA\src\components\` and related UI components  
**Total Mock Data Definitions Found:** 23

---

## Executive Summary

The SPECKULA frontend uses **hybrid real/mock data** patterns across all major views. While real data hooks are integrated, **fallback mock data** is still required for:

1. **Reference/comparison data** - Competitor features, market signals (intentional, for UI reference)
2. **Configuration data** - Integration catalog, keyboard shortcuts (intentional, not changing)
3. **Static UI content** - FAQ, guides, help (intentional)
4. **Graceful degradation** - When real data is unavailable, mocks fill the gap

Most views follow this pattern:
```tsx
const realData = useHook();
const display = realData.length > 0 ? realData : MOCK_FALLBACK;
```

---

## By Component: Full Inventory

### 1. DashboardView.tsx (Lines 93-163)
**Purpose:** Real-time operating intelligence with fallback to mock data

#### MOCK_ANALYSES (Lines 93-115)
```
3 Analysis objects (competitor analysis, reddit sentiment, market trends)
├─ title: "Competitor Positioning Analysis — Figma vs Speckula"
├─ progress: 67%
├─ startedAgo: "8m ago"
├─ color: "bg-blue-500"

2. "Reddit Sentiment Scan — PM Tools subreddit", progress: 34%, started 23m ago
3. "Market trend synthesis — Q2 2026 signals", progress: 89%, started 2m ago
```

**Usage Pattern (Line 559-561):**
```tsx
const activeJobs = (jobsData?.jobs ?? [])
  .filter((j) => j.status === "queued" || j.status === "processing")
  .slice(0, 3);
const analyses: Analysis[] = activeJobs.length > 0
  ? activeJobs.map(mapJob)
  : MOCK_ANALYSES;
```

**Should Be Replaced By:**
- Real data: `useAgentJobs()` filtered for running/queued status
- Source: Backend `/api/agents/jobs` endpoint
- Status: ✅ Already has real data integration, mock is fallback

---

#### MOCK_MARKET_SIGNALS (Lines 117-123)
```
5 MarketSignal objects showing growth trends:
1. "AI-native tools adoption", change: 340%, up: true
2. "PM tool switching intent", change: 127%, up: true
3. "Notion alternative" searches, change: 89%, up: true
4. "Linear enterprise churn", change: 34%, up: true
5. "Startup OS category", change: 512%, up: true
```

**Usage Pattern (Line 563-565):**
```tsx
const marketSignals: MarketSignal[] = signalsData?.signals?.length
  ? signalsData.signals.slice(0, 5).map(mapSignal)
  : MOCK_MARKET_SIGNALS;
```

**Should Be Replaced By:**
- Real data: `useMarketSignals()` 
- Source: Backend `/api/market/*` endpoint
- Maps to: MarketSignal DB table (signalType, strength, detectedAt)
- Status: ✅ Already has real data, mock is fallback

---

#### MOCK_DECISIONS (Lines 125-147)
```
3 Decision objects:
1. "Launch freemium tier", score: 87, priority: "High", 2 days ago
2. "Ship browser extension v2", score: 91, priority: "Critical", 1 day ago
3. "Expand competitor monitoring", score: 74, priority: "Medium", 3 days ago
```

**Usage Pattern (Line 795):**
```tsx
(experimentsData?.experiments ?? MOCK_DECISIONS.slice(0, 3))
  .slice(0, 3)
  .map((item: ExperimentSummary | Decision) => {
    // Mixed rendering: experiments get mapped to decision format
  });
```

**Should Be Replaced By:**
- Real data: `useExperiments()` (currently mapped experiments → decisions)
- Alternative: Dedicated decision hook (not yet implemented)
- Source: Backend `/api/roadmaps/*` or `/api/decisions/*`
- Status: ⚠️ Hybrid - experiments rendered as decisions, no dedicated decision API yet

---

#### MOCK_COMPETITORS (Lines 149-155)
```
5 Competitor objects:
1. { id: "notion", name: "Notion", initial: "N", color: "bg-zinc-700", 
     updatedAgo: "2h ago", stale: false }
2. { id: "linear", name: "Linear", ... updatedAgo: "5h ago", stale: false }
3. { id: "productboard", name: "Productboard", ... updatedAgo: "1d ago", stale: false }
4. { id: "figma", name: "Figma", ... updatedAgo: "3h ago", stale: false }
5. { id: "jira", name: "Jira", ... updatedAgo: "2d ago", stale: true }
```

**Usage Pattern (Line 567-569):**
```tsx
const competitors: Competitor[] = competitorsData?.competitors?.length
  ? competitorsData.competitors.slice(0, 5).map(mapCompetitor)
  : MOCK_COMPETITORS;
```

**Should Be Replaced By:**
- Real data: `useCompetitors()` 
- Source: Backend `/api/competitors` endpoint
- Status: ✅ Already has real data, mock is fallback

---

#### MOCK_METRICS (Lines 157-163)
```
Object with 5 metric strings:
{
  totalSignals: "847",
  weeklyCaptures: "34",
  aiJobsRunning: "12",
  competitorDomains: "6",
  activeAgents: "3"
}
```

**Usage Pattern (Lines 537-553):**
```tsx
const metrics = {
  totalSignals: overview?.totalSignals != null 
    ? String(overview.totalSignals) 
    : MOCK_METRICS.totalSignals,
  weeklyCaptures: overview?.weeklyCaptures != null 
    ? String(overview.weeklyCaptures) 
    : MOCK_METRICS.weeklyCaptures,
  // ... similar pattern for other metrics
};
```

**Should Be Replaced By:**
- Real data: `useDashboard()` overview object
- Source: `/api/dashboard` endpoint 
- Status: ✅ Already has real data, mock is fallback

---

### 2. CompetitorsView.tsx (Lines 59-206)

#### COMPETITORS (Lines 59-140)
```
5 detailed Competitor objects:
1. "Notion" - Workspace & PM
   ├─ pricing: { free: "$0", pro: "$12/mo", business: "$18/mo", enterprise: "Custom" }
   ├─ recentChanges: ["Raised Business plan 15%", "Launched AI v2", "Added Q&A"]
   ├─ positioning: "All-in-one workspace for notes, docs, wikis"
   ├─ weaknesses: ["Complex onboarding", "Performance on large docs", "No realtime collab"]
   ├─ userComplaints: ["Too slow", "Pricing increase", "AI feels bolted on"]
   ├─ features: ["Docs", "Database", "AI", "Templates", "API", "Integrations"]
   └─ score: 78, threat: "high", status: "active"

2. "Linear" - Issue Tracking
   ├─ pricing: { free: "$0", pro: "$8/mo", business: "$14/mo", enterprise: "Custom" }
   ├─ score: 65, threat: "medium", status: "active"

3. "Productboard" - Product Management  
   ├─ score: 71, threat: "high", pricing higher ($25-$75+)

4. "Figma" - Design & Collaboration
   ├─ score: 45, threat: "low" (different category)

5. "Jira" - Project Management
   ├─ score: 52, threat: "medium", status: "stale" (2d+ old)
```

**Usage Pattern (Lines 629-680):**
```tsx
// Has real data section (RealCompetitorCard)
{hasRealData && (
  <div>
    <p>Live-Monitored Competitors</p>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {competitorsData!.competitors.map((c) => (
        <RealCompetitorCard key={c.domain} competitor={c} />
      ))}
    </div>
  </div>
)}

// Then shows reference/demo competitors (COMPETITORS array)
{!loading && (
  <div>
    {hasRealData && (
      <p>Reference Competitors</p>
    )}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {filteredCompetitors.map((competitor) => (
        <CompetitorCard {...} />
      ))}
    </div>
  </div>
)}
```

**Status:** ✅ **INTENTIONAL** - Two-tier display:
- Real data shown first (live-monitored competitors)
- Mock data shown below as reference for UI/comparison

---

#### RECENT_ALERTS (Lines 142-183)
```
5 alert objects mixing real + mock:
1. "Notion: Business plan price increase detected", type: "pricing", 2h ago
2. "Linear: New feature shipped (Timeline)", type: "feature", 5h ago
3. "Productboard: Launched AI prioritization", type: "feature", 1d ago
4. "Figma: Dev Mode moved to paid tier", type: "pricing", 1d ago
5. "Jira: AI summary feature now in beta", type: "feature", 2d ago
```

**Usage Pattern (Lines 533-547):**
```tsx
const realAlerts = hasRealChanges
  ? changesData!.changes.slice(0, 5).map((ch) => ({
      id: ch.id,
      icon: ch.insightType?.includes("pric") ? DollarSign : Zap,
      description: `${ch.competitorName}: ${ch.title}`,
      time: formatTimeAgo(ch.capturedAt),
      competitor: ch.competitorName,
      type: ch.insightType?.includes("pric") ? "pricing" : "feature",
    }))
  : [];

const displayAlerts = [
  ...realAlerts,
  ...RECENT_ALERTS.filter((a) => !realAlerts.find((r) => r.competitor === a.competitor)),
].slice(0, 7);
```

**Status:** ✅ **INTENTIONAL HYBRID** - Merges real alerts with mock fallback

---

#### MATRIX_ROWS (Lines 199-206)
```
6 MatrixRow objects for feature comparison:
1. "AI Intelligence" - speckula: "yes", notion: "partial", ...
2. "Market Monitoring" - speckula: "yes", others: "no"/"partial"
3. "Competitor Tracking" - speckula: "yes", others: "no"
4. "PM Workflow" - speckula: "yes", notion: "partial", ...
5. "Browser Extension" - speckula: "yes", others: "no"
6. "Startup Memory" - speckula: "yes", others: "no"
```

**Usage Pattern (Lines 721-740):**
```tsx
<tbody>
  {MATRIX_ROWS.map((row, i) => (
    <tr key={row.feature} className={...}>
      <td>{row.feature}</td>
      <td><MatrixCell value={row.speckula} highlight /></td>
      <td><MatrixCell value={row.notion} /></td>
      {/* ... etc for Linear, Productboard, Figma, Jira */}
    </tr>
  ))}
</tbody>
```

**Status:** ✅ **INTENTIONAL** - Static reference data (hardcoded comparison grid)  
**Note:** This is marketing/positioning data, not user-generated data. Intentional to show Speckula's competitive positioning.

---

### 3. InsightsView.tsx (Lines 72-221)

#### SIGNALS (Lines 72-185)
```
8 Signal objects from social media:
1. Reddit r/startups: "Why do all PM tools feel like enterprise bloatware?"
   ├─ votes: 847, comments: 234, timeAgo: "2h", trend: "rising", urgency: "high"

2. Reddit r/ProductManagement: "Notion AI is disappointing — feels like ChatGPT..."
   ├─ votes: 512, comments: 89, trend: "rising", urgency: "high"

3. Twitter/X: "AI-native PM tools trending among YC W26 founders"
   ├─ votes: 1240, comments: 156, trend: "viral", urgency: "high"

4. Reddit r/SaaS: "Market gap: No tool connects market research to decisions"
   ├─ votes: 634, comments: 178, trend: "rising", urgency: "medium"

5. HackerNews: "Show HN: We automated our competitor monitoring with GPT-4"
   ├─ votes: 3241, comments: 412, trend: "viral", urgency: "high"

6. Reddit r/Entrepreneur: "How do you actually track what competitors are doing?"
   ├─ votes: 289, comments: 67, trend: "stable", urgency: "medium"

7. ProductHunt: "Launched: Competitive intelligence tool — 847 upvotes"
   ├─ votes: 847, comments: 123, trend: "stable", urgency: "medium"

8. Twitter/X: "Productboard pricing increase is killing early-stage startups"
   ├─ votes: 456, comments: 89, trend: "falling", urgency: "low"
```

**Usage Pattern (Lines 620-628):**
```tsx
const hasRealSignals = signalsData?.signals && signalsData.signals.length > 0;
const displaySignals = hasRealSignals 
  ? signalsData!.signals 
  : SIGNALS;

{displaySignals.map((signal) => (
  <SignalCard key={signal.id} signal={signal} />
))}
```

**Should Be Replaced By:**
- Real data: `useMarketSignals()` 
- Source: Backend `/api/market/signals` endpoint
- Status: ⚠️ Real hook exists but fallback to SIGNALS when empty

---

#### TRENDS (Lines 187-194)
```
6 Trend objects with growth metrics:
1. "AI-native PM tools", growth: "+512%", volume: "34K mentions", 
   category: "category_creation", momentum: 95

2. "Startup memory/context", growth: "+340%", volume: "18K mentions",
   category: "feature_demand", momentum: 88

3. "PM tool switching", growth: "+127%", volume: "9K mentions",
   category: "churn_signal", momentum: 72

4. "Notion alternative", growth: "+89%", volume: "52K mentions",
   category: "competitor_weakness", momentum: 67

5. "Autonomous research", growth: "+445%", volume: "12K mentions",
   category: "feature_demand", momentum: 91

6. "PM + AI workflow", growth: "+278%", volume: "23K mentions",
   category: "category_creation", momentum: 83
```

**Usage Pattern (Line 620-628):**
```tsx
const hasRealTrends = trendsData?.byType && trendsData.byType.length > 0;
const displayTrends = hasRealTrends 
  ? trendsData!.byType.slice(0, 6) 
  : TRENDS;

{displayTrends.map((trend) => (
  <TrendCard key={trend.name} trend={trend} />
))}
```

**Should Be Replaced By:**
- Real data: `useMarketTrends()` 
- Source: Backend `/api/market/trends` endpoint
- Status: ⚠️ Real hook exists but fallback to TRENDS when empty

---

#### OPPORTUNITIES (Lines 196-221)
```
4 Opportunity objects:
1. "AI-native startup OS"
   ├─ description: "No tool connects research → decisions → execution. 34K mentions."
   ├─ strength: 95, category: "market_gap"

2. "Automated competitor monitoring"
   ├─ description: "3K+ upvotes on DIY solution. Demand for automated tracking."
   ├─ strength: 88, category: "feature_demand"

3. "Early-stage PM tooling"
   ├─ description: "All major tools target enterprise. Productboard at $75/mo..."
   ├─ strength: 82, category: "pricing_opportunity"

4. "Startup memory layer"
   ├─ description: '"Context amnesia" — founders losing knowledge as teams grow'
   ├─ strength: 79, category: "market_gap"
```

**Usage Pattern (implied):**
```tsx
// Used as fallback when no real opportunities detected
const displayOpportunities = hasRealOpportunities 
  ? realOpportunities 
  : OPPORTUNITIES;
```

**Status:** ⚠️ No real data hook found - **NEEDS IMPLEMENTATION**

---

### 4. AgentsView.tsx (Lines 63-193)

#### AGENTS (Lines 63-142)
```
6 Agent objects (autonomous agents configuration):
1. "Market Scanner"
   ├─ description: "Monitors Reddit, HN, Twitter for market signals"
   ├─ status: "running", type: "intelligence", lastRun: "2m ago"
   ├─ nextRun: "Continuous", tasksCompleted: 1247, successRate: 97%
   ├─ currentTask: "Scanning r/startups for PM tool discussions"
   ├─ uptime: "99.2%"

2. "Competitor Watcher"
   ├─ description: "Tracks pricing, features, positioning changes"
   ├─ status: "running", type: "intelligence", lastRun: "8m ago"
   ├─ nextRun: "Every 15m", tasksCompleted: 892, successRate: 99%
   ├─ currentTask: "Analyzing notion.so pricing page changes"

3. "Insight Synthesizer"
   ├─ description: "Synthesizes signals into actionable insights"
   ├─ status: "running", type: "synthesis", lastRun: "23m ago"
   ├─ nextRun: "Every 1h", tasksCompleted: 234, successRate: 94%

4. "Decision Scorer"
   ├─ description: "Scores and validates strategic decisions"
   ├─ status: "idle", type: "analysis", lastRun: "2h ago"
   ├─ nextRun: "On trigger", tasksCompleted: 67, successRate: 91%

5. "Experiment Analyzer"
   ├─ description: "Monitors A/B tests and extracts learnings"
   ├─ status: "running", type: "analysis", lastRun: "45m ago"
   ├─ nextRun: "Every 4h", tasksCompleted: 34, successRate: 88%

6. "Weekly Digest"
   ├─ description: "Compiles and sends weekly intelligence summaries"
   ├─ status: "scheduled", type: "delivery", lastRun: "3d ago"
   ├─ nextRun: "Monday 9am", tasksCompleted: 12, successRate: 100%
```

**Usage Pattern (Lines 387-410):**
```tsx
const { data: agentsData } = useAgents();

const displayAgents = agentsData?.agents ?? AGENTS;

{displayAgents.map((agent) => (
  <AgentCard key={agent.id} agent={agent} />
))}
```

**Should Be Replaced By:**
- Real data: `useAgents()` 
- Source: Backend `/api/agents` endpoint
- Status: ✅ Already has real data integration, mock is fallback

---

#### EXECUTION_LOG (Lines 144-193)
```
6 ExecutionLogEntry objects showing agent activity:
1. Market Scanner - "Signal detected" - "47 mentions of PM tool switching" - 2m ago
2. Competitor Watcher - "Change detected" - "Notion pricing +$3/mo" - 8m ago  
3. Insight Synthesizer - "Insight generated" - "AI-native tools growing 512%" - 23m ago
4. Market Scanner - "Viral signal" - "HackerNews: DIY competitor monitoring" - 35m ago
5. Experiment Analyzer - "Result updated" - "Onboarding B +23% activation" - 45m ago
6. Decision Scorer - "Score updated" - "Launch freemium scored 91/100" - 2h ago
```

**Usage Pattern (Lines 459-476):**
```tsx
const displayLog = jobsData?.jobs?.length > 0 
  ? jobsData.jobs.map(mapJobToLog)
  : EXECUTION_LOG;

{displayLog.map((entry) => (
  <LogEntry key={entry.id} entry={entry} />
))}
```

**Should Be Replaced By:**
- Real data: Job execution logs from `useAgentJobs()` 
- Source: Backend `/api/agents/jobs` endpoint
- Status: ⚠️ Real data hook exists but EXECUTION_LOG used as fallback

---

### 5. WorkspaceView.tsx (Lines 48-63)

#### QUICK_ACTIONS (Lines 48-53)
```
4 quick action configurations:
1. "Add Signal" → view: "market-intelligence", icon: Lightbulb, color: amber
2. "Make Decision" → view: "decisions", icon: Compass, color: blue
3. "Write Spec" → view: "specifications", icon: LayoutDashboard, color: green
4. "Create Task" → view: "tasks", icon: CheckSquare, color: purple
```

**Status:** ✅ **INTENTIONAL** - Static UI navigation configuration  
**Purpose:** Hardcoded buttons/shortcuts to different views

---

#### PHASE_CONFIG (Lines 56-61)
```
4 phase configurations for brain health:
1. "Signals" → field: "weeklyCaptures", target: 15
2. "Competitors" → field: "competitorInsights", target: 10
3. "AI Analyses" → field: "aiJobsCompleted", target: 20
4. "Brain entries" → field: "productBrainTotal", target: 30
```

**Status:** ✅ **INTENTIONAL** - Configuration/reference data  
**Purpose:** Defines which metrics map to which "phase" with soft targets for progress bars

---

#### AVATAR_COLORS (Line 63)
```
5 color classes: ["bg-pink-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500"]
```

**Status:** ✅ **INTENTIONAL** - UI color palette  
**Used for:** Deterministic user avatar coloring (hash-based)

---

### 6. ExtensionView.tsx (Lines 28-33)

#### STEP_META (Lines 28-33)
```
4 setup step configurations:
1. title: "Install extension", sub: "Add from Chrome Web Store", key: "installed"
2. title: "Copy your token", sub: "Use token below to authenticate", key: "tokenCopied"
3. title: "Paste in extension", sub: "Open extension → Settings → Token", key: "tokenPasted"
4. title: "Start analysing", sub: "Browse any page and click Analyse", key: "firstCapture"
```

**Status:** ✅ **INTENTIONAL** - Static UI copy for setup flow  
**Purpose:** Extension onboarding steps are hardcoded, not data-driven

---

### 7. SlackView.tsx (Lines 86-180)

#### INTEGRATION_CATALOG (Lines 86-175)
```
7 integration configurations:
1. "GitHub" - Sync repos, PRs, issues, releases
   ├─ features: ["PR tracking", "Issue sync", "Release monitoring", "Code activity"]
   ├─ syncFrequency: "Real-time"
   ├─ permissions: ["repo:read", "issues:read", "pull_requests:read"]

2. "Slack" - Intelligence alerts and digests
   ├─ features: ["Alerts", "Weekly digests", "Decision notifications", "Competitor alerts"]
   ├─ syncFrequency: "On trigger"

3. "Notion" - Bidirectional sync
   ├─ features: ["Decision sync", "PRD export", "Research import", "Database sync"]
   ├─ syncFrequency: "Every 15 min"

4. "Jira" - Push tasks from decisions
   ├─ features: ["Issue creation", "Sprint sync", "Status tracking", "Epic mapping"]
   ├─ syncFrequency: "Every 30 min"

5. "Figma" - Import design signals
   ├─ features: ["File import", "Design signals", "Component tracking", "Prototype links"]
   ├─ syncFrequency: "On demand"

6. "PostHog" - Analytics integration
   ├─ features: ["Event tracking", "Cohort data", "Funnel analysis", "Feature flags"]
   ├─ syncFrequency: "Real-time"

7. "Mixpanel" - User behavior data
   ├─ features: ["User journeys", "Retention data", "Event data", "A/B results"]
   ├─ syncFrequency: "Every 1h"

8. "Linear" - Issue & roadmap sync
   ├─ features: ["Issue sync", "Cycle tracking", "Project mapping", "Roadmap sync"]
   ├─ syncFrequency: "Real-time"
```

**Status:** ✅ **INTENTIONAL** - Static product configuration  
**Purpose:** Integration catalog is hardcoded. Real status/lastSync come from Firestore, not this array.

---

#### CATEGORIES (Lines 177-180)
```
7 category filter strings:
["All", "Development", "Communication", "Productivity", "Analytics", "Project Management", "Design"]
```

**Status:** ✅ **INTENTIONAL** - Static UI filter categories

---

### 8. HelpView.tsx (Lines 10-61)

#### FAQS (Lines 10-43)
```
8 FAQ pairs covering:
- "How does Speckula's AI work?"
- "What is a Signal?"
- "How do I link a Signal to a Decision?"
- "Can I export my specs and decisions?"
- "How does the Chrome extension sync?"
- "What does Autonomous Mode do?"
- "How do I invite team members?"
- "Is my data secure?"
```

**Status:** ✅ **INTENTIONAL** - Static help content  
**Purpose:** Hardcoded FAQs (documentation, not user data)

---

#### GUIDES (Lines 45-52)
```
6 guide configurations:
1. "Capturing your first signal" - 3 min, Getting started
2. "Making evidence-backed decisions" - 5 min, Core workflow
3. "Writing specs with AI assistance" - 7 min, Core workflow
4. "Managing tasks and sprints" - 4 min, Productivity
5. "Using Autonomous Mode" - 6 min, Advanced
6. "Setting up the Chrome extension" - 3 min, Extension
```

**Status:** ✅ **INTENTIONAL** - Static help content

---

#### SHORTCUTS (Lines 54-61)
```
6 keyboard shortcut configurations:
⌘K → "New document"
⌘⇧I → "Go to Signals"
⌘⇧D → "Go to Decisions"
⌘⇧P → "Go to Specs"
⌘/ → "Open AI panel"
⌘\ → "Toggle sidebar"
```

**Status:** ✅ **INTENTIONAL** - Static configuration (hardcoded keybinds)

---

### 9. ActivityView.tsx (Line 75)

#### AVATAR_COLORS (Line 75)
```
6 color classes: ["bg-slate-500", "bg-blue-500", "bg-pink-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500"]
```

**Status:** ✅ **INTENTIONAL** - UI color palette for activity avatars

---

## Summary Table: Mock Data Inventory

| File | Mock Data | Type | Lines | Real Hook | Status | Should Replace? |
|------|-----------|------|-------|-----------|--------|-----------------|
| **DashboardView.tsx** |
| | MOCK_ANALYSES | 3 jobs | 93-115 | useAgentJobs() | ✅ Active fallback | ✅ Use real data |
| | MOCK_MARKET_SIGNALS | 5 signals | 117-123 | useMarketSignals() | ✅ Active fallback | ✅ Use real data |
| | MOCK_DECISIONS | 3 decisions | 125-147 | useExperiments() | ⚠️ Hybrid | ✅ Use real decisions API |
| | MOCK_COMPETITORS | 5 competitors | 149-155 | useCompetitors() | ✅ Active fallback | ✅ Use real data |
| | MOCK_METRICS | 5 metrics | 157-163 | useDashboard() | ✅ Active fallback | ✅ Use real data |
| **CompetitorsView.tsx** |
| | COMPETITORS | 5 competitors | 59-140 | useCompetitors() | ✅ Intentional ref | ⚠️ Keep for reference |
| | RECENT_ALERTS | 5 alerts | 142-183 | useCompetitorChanges() | ✅ Hybrid mix | ✅ Prefer real data |
| | MATRIX_ROWS | 6 rows | 199-206 | (none) | ✅ Intentional | ✅ Keep (marketing data) |
| **InsightsView.tsx** |
| | SIGNALS | 8 signals | 72-185 | useMarketSignals() | ⚠️ Fallback only | ✅ Use real data |
| | TRENDS | 6 trends | 187-194 | useMarketTrends() | ⚠️ Fallback only | ✅ Use real data |
| | OPPORTUNITIES | 4 opportunities | 196-221 | (none) | ❌ No hook | ✅ Implement hook |
| **AgentsView.tsx** |
| | AGENTS | 6 agents | 63-142 | useAgents() | ✅ Active fallback | ✅ Use real data |
| | EXECUTION_LOG | 6 entries | 144-193 | useAgentJobs() | ⚠️ Partial fallback | ✅ Use real data |
| **WorkspaceView.tsx** |
| | QUICK_ACTIONS | 4 actions | 48-53 | (none) | ✅ Intentional | ✅ Keep (config) |
| | PHASE_CONFIG | 4 phases | 56-61 | (none) | ✅ Intentional | ✅ Keep (config) |
| | AVATAR_COLORS | 5 colors | 63 | (none) | ✅ Intentional | ✅ Keep (palette) |
| **ExtensionView.tsx** |
| | STEP_META | 4 steps | 28-33 | (none) | ✅ Intentional | ✅ Keep (copy) |
| **SlackView.tsx** |
| | INTEGRATION_CATALOG | 7 integrations | 86-175 | (none) | ✅ Intentional | ✅ Keep (config) |
| | CATEGORIES | 7 categories | 177-180 | (none) | ✅ Intentional | ✅ Keep (filter) |
| **HelpView.tsx** |
| | FAQS | 8 Q&As | 10-43 | (none) | ✅ Intentional | ✅ Keep (help content) |
| | GUIDES | 6 guides | 45-52 | (none) | ✅ Intentional | ✅ Keep (help content) |
| | SHORTCUTS | 6 shortcuts | 54-61 | (none) | ✅ Intentional | ✅ Keep (config) |
| **ActivityView.tsx** |
| | AVATAR_COLORS | 6 colors | 75 | (none) | ✅ Intentional | ✅ Keep (palette) |

**Legend:**
- ✅ = Intentional, working as designed
- ⚠️ = Hybrid/partial, needs attention
- ❌ = Missing, needs implementation
- **Type:** What the mock data represents

---

## Recommendations by Priority

### Priority 1: Replace with Real Data (Active Fallbacks)
These should be replaced but are already hooked up; just remove the fallback:

1. **MOCK_ANALYSES** (DashboardView) - Remove fallback, trust useAgentJobs()
2. **MOCK_MARKET_SIGNALS** (DashboardView) - Remove fallback, trust useMarketSignals()
3. **MOCK_COMPETITORS** (DashboardView) - Remove fallback, trust useCompetitors()
4. **MOCK_METRICS** (DashboardView) - Remove fallback, trust useDashboard()
5. **SIGNALS** (InsightsView) - Remove fallback, trust useMarketSignals()
6. **TRENDS** (InsightsView) - Remove fallback, trust useMarketTrends()
7. **AGENTS** (AgentsView) - Remove fallback, trust useAgents()

**Action:** Delete MOCK_* constant and conditional logic in each component.

---

### Priority 2: Implement Missing Hooks
These require new API endpoints + hooks:

1. **OPPORTUNITIES** (InsightsView) - **MISSING HOOK**
   - Need: `useMarketOpportunities()` or similar
   - Source: Backend `/api/market/opportunities` endpoint
   - Data model: Already in schema (MarketSignal strength used as proxy)

2. **Dedicated Decisions API** (DashboardView)
   - Currently: Experiments mapped to decisions (line 795-823)
   - Better: Dedicated `/api/decisions` endpoint + `useDecisions()` hook
   - Current workaround acceptable but not ideal

---

### Priority 3: Keep as Intentional (Static Config/Copy)
These are intentional and should **NOT** be replaced:

**UI Configuration:**
- QUICK_ACTIONS (WorkspaceView)
- PHASE_CONFIG (WorkspaceView)
- AVATAR_COLORS (WorkspaceView, ActivityView)
- STEP_META (ExtensionView)
- INTEGRATION_CATALOG (SlackView)
- CATEGORIES (SlackView)

**Help/Documentation:**
- FAQS (HelpView)
- GUIDES (HelpView)
- SHORTCUTS (HelpView)

**Reference/Marketing Data:**
- MATRIX_ROWS (CompetitorsView) - Competitive positioning matrix
- COMPETITORS (CompetitorsView) - Reference competitors shown alongside real data

---

## Migration Checklist

```
[ ] DashboardView.tsx
    [ ] Remove MOCK_ANALYSES (Line 93-115)
    [ ] Remove MOCK_MARKET_SIGNALS (Line 117-123)
    [ ] Remove MOCK_DECISIONS (Line 125-147)
    [ ] Remove MOCK_COMPETITORS (Line 149-155)
    [ ] Remove MOCK_METRICS (Line 157-163)
    [ ] Remove fallback conditionals (Lines 537-569)
    [ ] Ensure real hooks always return non-empty data or show empty state

[ ] CompetitorsView.tsx
    [ ] Keep COMPETITORS (reference data)
    [ ] Prefer real alerts over RECENT_ALERTS merge
    [ ] Keep MATRIX_ROWS (intentional positioning data)

[ ] InsightsView.tsx
    [ ] Remove SIGNALS fallback (Lines 72-185)
    [ ] Remove TRENDS fallback (Lines 187-194)
    [ ] Implement useMarketOpportunities() hook
    [ ] Remove OPPORTUNITIES fallback once hook available

[ ] AgentsView.tsx
    [ ] Remove AGENTS fallback (Lines 63-142)
    [ ] Remove EXECUTION_LOG fallback (Lines 144-193)
    [ ] Ensure useAgents() always populated

[ ] WorkspaceView, ExtensionView, SlackView, HelpView, ActivityView
    [ ] Keep all QUICK_ACTIONS, STEP_META, INTEGRATION_CATALOG, FAQS, etc.
    [ ] These are intentional static configurations
```

---

## Conclusion

**Current State:**
- 23 mock data definitions found
- 9 are intentional (static config/help content)
- 7 are active fallbacks (have real hooks, should be cleaned up)
- 1 is missing a hook (OPPORTUNITIES)
- 1 is hybrid usage (DECISIONS/EXPERIMENTS)

**Next Steps:**
1. Remove fallback mock data from views with working hooks
2. Implement useMarketOpportunities() hook + backend endpoint
3. Keep intentional static configuration/copy as-is
4. Consider dedicated Decisions API vs. Experiments workaround
