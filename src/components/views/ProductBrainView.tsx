"use client";

import { useState, useEffect, useRef } from "react";
import {
  Brain,
  BookOpen,
  Compass,
  AlertTriangle,
  Lightbulb,
  FlaskConical,
  Search,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Link2,
  Tag,
  Zap,
  TrendingUp,
  Database,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Types ──────────────────────────────────────────────────────────────────

type MemoryType = "learning" | "decision" | "assumption" | "insight" | "experiment";
type MemoryCategory = "market" | "product" | "strategy" | "competitor" | "growth";

interface Memory {
  id: string;
  type: MemoryType;
  category: MemoryCategory;
  title: string;
  content: string;
  tags: string[];
  confidence: number;
  source: string;
  createdAt: string;
  connections: number;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MEMORIES: Memory[] = [
  {
    id: "1",
    type: "learning",
    category: "market",
    title: "Early-stage PMs need automated context, not manual data entry",
    content:
      "After analyzing 847 Reddit posts and 12 user interviews, the core insight: PMs spend 4h/week manually aggregating context. The job-to-be-done is \"ambient intelligence\" — the tool should learn and surface, not require input.",
    tags: ["market-insight", "jtbd", "validated"],
    confidence: 94,
    source: "Market analysis",
    createdAt: "2 days ago",
    connections: 7,
  },
  {
    id: "2",
    type: "decision",
    category: "product",
    title: "Launch freemium with browser extension as growth lever",
    content:
      "Decision: Lead with free browser extension (zero friction) → demonstrate value through automatic intelligence capture → convert when Product Brain fills with context. Extension becomes the moat.",
    tags: ["growth", "freemium", "decided"],
    confidence: 91,
    source: "Decision Engine",
    createdAt: "3 days ago",
    connections: 5,
  },
  {
    id: "3",
    type: "assumption",
    category: "strategy",
    title: "Startups will pay $49/mo for an autonomous PM intelligence layer",
    content:
      "Assumption: If SPECKULA can autonomously monitor competitors + surface market signals + connect to execution — early-stage startups (seed to Series A) will pay $49/mo. Needs validation.",
    tags: ["pricing", "unvalidated", "critical"],
    confidence: 67,
    source: "Founder hypothesis",
    createdAt: "5 days ago",
    connections: 3,
  },
  {
    id: "4",
    type: "insight",
    category: "competitor",
    title: "Notion AI failed because it lacks product context — our core advantage",
    content:
      "Notion AI generates generic summaries. SPECKULA's advantage: we know your product, your market, your decisions. AI is only valuable when it has context. This is our moat.",
    tags: ["competitive-advantage", "validated", "ai"],
    confidence: 89,
    source: "Competitor analysis",
    createdAt: "1 week ago",
    connections: 9,
  },
  {
    id: "5",
    type: "experiment",
    category: "growth",
    title: "Onboarding A/B Test: Context-first vs Feature-first",
    content:
      "Hypothesis: Showing users their \"startup context\" being built in real-time during onboarding increases activation by 30%+. Running A/B test. Current result: Variant B (context-first) +23% activation at 234 users.",
    tags: ["experiment", "running", "onboarding"],
    confidence: 76,
    source: "Growth team",
    createdAt: "4 days ago",
    connections: 4,
  },
  {
    id: "6",
    type: "learning",
    category: "product",
    title: "Browser extension is the #1 acquisition channel hypothesis",
    content:
      "Extension gives immediate value (capture + analyze any page) with zero setup. Compare: Productboard requires 2h setup. Our extension: 30s. Hypothesis: extension installs convert at 3x rate.",
    tags: ["acquisition", "extension", "hypothesis"],
    confidence: 81,
    source: "Product analysis",
    createdAt: "1 week ago",
    connections: 6,
  },
  {
    id: "7",
    type: "insight",
    category: "market",
    title: "YC W26 cohort is 40% AI-native startups — prime target segment",
    content:
      "YC W26: 40% of companies are AI-native. These founders understand AI-native tools. They're building with AI, not adopting AI. Perfect early adopter segment.",
    tags: ["segment", "yc", "early-adopters"],
    confidence: 92,
    source: "Market research",
    createdAt: "6 days ago",
    connections: 8,
  },
  {
    id: "8",
    type: "assumption",
    category: "product",
    title: "Autonomous mode will become primary PM workflow within 18 months",
    content:
      "Assumption: As AI agents mature, the PM workflow shifts from \"using tools\" to \"supervising agents\". SPECKULA must build for this future now. Autonomous mode is the 2027 product, built today.",
    tags: ["future", "autonomous", "unvalidated"],
    confidence: 58,
    source: "Founder vision",
    createdAt: "2 weeks ago",
    connections: 2,
  },
];

const AI_PATTERNS = [
  {
    id: "p1",
    priority: "high",
    label: "Market timing is strong",
    detail: "3 converging signals point to PMF window in the next 6 months.",
  },
  {
    id: "p2",
    priority: "critical",
    label: "Pricing assumption needs validation",
    detail: "Low confidence score (67%). Schedule a pricing discovery sprint.",
  },
  {
    id: "p3",
    priority: "medium",
    label: "Competitor gap identified",
    detail: "No tool combines browser extension + PM workflow automation.",
  },
];

const TOP_TAGS = [
  { label: "validated", weight: 9 },
  { label: "market-insight", weight: 8 },
  { label: "extension", weight: 7 },
  { label: "jtbd", weight: 8 },
  { label: "freemium", weight: 6 },
  { label: "ai", weight: 7 },
  { label: "growth", weight: 9 },
  { label: "competitor", weight: 5 },
  { label: "hypothesis", weight: 6 },
  { label: "unvalidated", weight: 5 },
  { label: "segment", weight: 4 },
  { label: "autonomous", weight: 4 },
];

const FILTER_TABS: { label: string; value: MemoryType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Learnings", value: "learning" },
  { label: "Decisions", value: "decision" },
  { label: "Assumptions", value: "assumption" },
  { label: "Insights", value: "insight" },
  { label: "Experiments", value: "experiment" },
];

// ─── Helper Maps ─────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  MemoryType,
  { icon: React.ElementType; color: string; bg: string; border: string; label: string }
> = {
  learning: {
    icon: BookOpen,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    label: "Learning",
  },
  decision: {
    icon: Compass,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    label: "Decision",
  },
  assumption: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    label: "Assumption",
  },
  insight: {
    icon: Lightbulb,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    label: "Insight",
  },
  experiment: {
    icon: FlaskConical,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    label: "Experiment",
  },
};

const CATEGORY_CONFIG: Record<MemoryCategory, { bg: string; text: string }> = {
  market: { bg: "bg-sky-500/10", text: "text-sky-400" },
  product: { bg: "bg-violet-500/10", text: "text-violet-400" },
  strategy: { bg: "bg-teal-500/10", text: "text-teal-400" },
  competitor: { bg: "bg-rose-500/10", text: "text-rose-400" },
  growth: { bg: "bg-lime-500/10", text: "text-lime-400" },
};

function confidenceColor(n: number) {
  if (n >= 80) return { bar: "bg-emerald-500", text: "text-emerald-400" };
  if (n >= 60) return { bar: "bg-amber-500", text: "text-amber-400" };
  return { bar: "bg-red-500", text: "text-red-400" };
}

function priorityConfig(p: string) {
  if (p === "critical") return { dot: "bg-red-500", text: "text-red-400", label: "Critical" };
  if (p === "high") return { dot: "bg-amber-500", text: "text-amber-400", label: "High" };
  return { dot: "bg-blue-500", text: "text-blue-400", label: "Medium" };
}

// ─── Sparkline SVG ───────────────────────────────────────────────────────────

function Sparkline() {
  // Simple upward-trending sparkline path
  const points = [10, 18, 14, 22, 19, 28, 24, 34, 30, 40];
  const w = 120;
  const h = 40;
  const maxVal = 40;
  const minVal = 10;
  const range = maxVal - minVal;
  const step = w / (points.length - 1);
  const coords = points.map((v, i) => {
    const x = i * step;
    const y = h - ((v - minVal) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const pathD = `M ${coords.join(" L ")}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="overflow-visible">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${pathD} L ${w},${h} L 0,${h} Z`}
        fill="url(#sparkGrad)"
      />
      <path d={pathD} stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points.length - 1 ? (points.length - 1) * step : 0} cy={h - ((points[points.length - 1] - minVal) / range) * (h - 4) - 2} r="3" fill="#10b981" />
    </svg>
  );
}

// ─── Memory Card ─────────────────────────────────────────────────────────────

interface MemoryCardProps {
  memory: Memory;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
}

function MemoryCard({ memory, expanded, onToggleExpand }: MemoryCardProps) {
  const tc = TYPE_CONFIG[memory.type];
  const cc = CATEGORY_CONFIG[memory.category];
  const conf = confidenceColor(memory.confidence);
  const Icon = tc.icon;

  return (
    <div
      className={`rounded-xl border border-border/60 bg-card/80 hover:bg-card transition-all duration-200 hover:border-border hover:shadow-md overflow-hidden`}
    >
      {/* Card Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Type Icon */}
          <div className={`mt-0.5 flex-shrink-0 rounded-lg p-2 ${tc.bg} ${tc.border} border`}>
            <Icon className={`h-4 w-4 ${tc.color}`} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Type label + Category badge */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-xs font-medium ${tc.color}`}>{tc.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cc.bg} ${cc.text}`}>
                {memory.category}
              </span>
            </div>
            {/* Title */}
            <h3 className="text-sm font-semibold text-foreground leading-snug mb-2">
              {memory.title}
            </h3>
            {/* Content */}
            <p
              className={`text-xs text-muted-foreground leading-relaxed transition-all ${
                expanded ? "" : "line-clamp-3"
              }`}
            >
              {memory.content}
            </p>
            {/* Expand toggle */}
            <button
              onClick={() => onToggleExpand(memory.id)}
              className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" /> Read more
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tags */}
        {memory.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pl-11">
            {memory.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-muted/60 text-muted-foreground border border-border/40"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="px-4 py-3 border-t border-border/40 bg-muted/20">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Confidence */}
          <div className="flex items-center gap-2 flex-1 min-w-[160px]">
            <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden flex-shrink-0">
              <div
                className={`h-full rounded-full ${conf.bar} transition-all`}
                style={{ width: `${memory.confidence}%` }}
              />
            </div>
            <span className={`text-xs font-semibold ${conf.text}`}>{memory.confidence}%</span>
            <span className="text-xs text-muted-foreground/60">confidence</span>
          </div>

          {/* Source */}
          <span className="text-xs text-muted-foreground/60 hidden sm:block">
            {memory.source}
          </span>

          {/* Connections */}
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Link2 className="h-3 w-3" />
            {memory.connections} connections
          </button>

          {/* Time */}
          <span className="text-xs text-muted-foreground/50">{memory.createdAt}</span>

          {/* Related */}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs ml-auto">
            Related
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/80 px-4 py-3 flex items-center gap-3">
      <div className={`rounded-lg p-2 bg-muted/60`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground/60">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Add Memory Form ──────────────────────────────────────────────────────────

interface AddMemoryFormProps {
  onClose: () => void;
}

function AddMemoryForm({ onClose }: AddMemoryFormProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<MemoryType>("learning");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card/90 p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          New Memory
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Type selector */}
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(TYPE_CONFIG) as MemoryType[]).map((t) => {
          const tc = TYPE_CONFIG[t];
          const Icon = tc.icon;
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                type === t
                  ? `${tc.bg} ${tc.color} ${tc.border}`
                  : "border-border/40 text-muted-foreground hover:border-border"
              }`}
            >
              <Icon className="h-3 w-3" />
              {tc.label}
            </button>
          );
        })}
      </div>

      <Input
        ref={inputRef}
        placeholder="Memory title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-8 text-sm bg-muted/40 border-border/60 focus:border-border"
      />

      <textarea
        placeholder="What did you learn, decide, or discover?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="w-full rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-border resize-none"
      />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 px-3 text-xs">
          Cancel
        </Button>
        <Button size="sm" className="h-7 px-3 text-xs" disabled={!title.trim()}>
          Save Memory
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProductBrainView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeType, setActiveType] = useState<MemoryType | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd+K focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Filter memories
  const filtered = MEMORIES.filter((m) => {
    const matchesType = activeType === "all" || m.type === activeType;
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      !q ||
      m.title.toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q) ||
      m.tags.some((t) => t.toLowerCase().includes(q));
    return matchesType && matchesQuery;
  });

  const handleToggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* ── Page Header ── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border/60 bg-card/30 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="rounded-xl bg-violet-500/10 border border-violet-500/30 p-2">
                <Brain className="h-5 w-5 text-violet-400" />
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Product Brain</h1>
            </div>
            <p className="text-sm text-muted-foreground pl-14">
              847 memories · 34 connections ·{" "}
              <span className="text-violet-400 font-medium">AI-indexed</span>
            </p>
          </div>
          <Button
            onClick={() => setShowAddForm((v) => !v)}
            size="sm"
            className="flex-shrink-0 h-8 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white border-0"
          >
            <Plus className="h-4 w-4" />
            Add Memory
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchRef}
            placeholder="Search memories, insights, decisions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-24 h-10 bg-muted/40 border-border/60 focus:border-violet-500/50 focus:ring-violet-500/20 text-sm"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-mono bg-muted border border-border/60 text-muted-foreground/60">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 mt-3 overflow-x-auto pb-0.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveType(tab.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeType === tab.value
                  ? "bg-violet-500/15 text-violet-400 border border-violet-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
              }`}
            >
              {tab.label}
              {tab.value !== "all" && (
                <span className="ml-1.5 opacity-60">
                  {MEMORIES.filter((m) => m.type === tab.value).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Main Feed ── */}
        <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5 space-y-4">
          {/* Top Metrics */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard
              icon={Database}
              label="Total Memories"
              value="847"
              iconColor="text-violet-400"
            />
            <MetricCard
              icon={Shield}
              label="High Confidence"
              value="312"
              sub="37% of total"
              iconColor="text-emerald-400"
            />
            <MetricCard
              icon={AlertTriangle}
              label="Unvalidated"
              value="45"
              sub="Need attention"
              iconColor="text-amber-400"
            />
            <MetricCard
              icon={Link2}
              label="Connected Insights"
              value="89"
              sub="Cross-referenced"
              iconColor="text-blue-400"
            />
          </div>

          {/* Add Memory Form */}
          {showAddForm && <AddMemoryForm onClose={() => setShowAddForm(false)} />}

          {/* Search result header */}
          {searchQuery && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {filtered.length === 0
                  ? "No memories found"
                  : `${filtered.length} result${filtered.length !== 1 ? "s" : ""} for "${searchQuery}"`}
              </span>
              <button onClick={() => setSearchQuery("")} className="text-xs hover:text-foreground transition-colors">
                Clear
              </button>
            </div>
          )}

          {/* Memory Feed */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Brain className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No memories match your search.</p>
                <button
                  onClick={() => { setSearchQuery(""); setActiveType("all"); }}
                  className="mt-2 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filtered.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  expanded={expandedId === memory.id}
                  onToggleExpand={handleToggleExpand}
                />
              ))
            )}
          </div>

          {/* Memory Network Preview */}
          <div className="rounded-xl border border-border/60 bg-card/60 p-5 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-foreground">Memory Network</h2>
              <span className="ml-auto text-xs text-muted-foreground/60">34 active connections</span>
            </div>

            {/* Central node + cluster grid */}
            <div className="relative flex flex-col items-center gap-4">
              {/* Central */}
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/40 shadow-sm">
                <Brain className="h-4 w-4 text-violet-400" />
                <span className="text-sm font-semibold text-violet-300">SPECKULA Core</span>
              </div>

              {/* Connector line visual */}
              <div className="w-px h-4 bg-border/60" />

              {/* Clusters */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full">
                {[
                  { label: "Market Intelligence", count: 12, color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/30" },
                  { label: "Product Decisions", count: 9, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/30" },
                  { label: "Growth Experiments", count: 7, color: "text-lime-400", bg: "bg-lime-500/10", border: "border-lime-500/30" },
                  { label: "Competitor Insights", count: 4, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" },
                  { label: "Strategy Assumptions", count: 3, color: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/30" },
                ].map((cluster) => (
                  <div
                    key={cluster.label}
                    className={`rounded-lg border ${cluster.border} ${cluster.bg} px-3 py-2.5 text-center hover:shadow-sm transition-all cursor-pointer`}
                  >
                    <p className={`text-lg font-bold ${cluster.color}`}>{cluster.count}</p>
                    <p className="text-xs text-muted-foreground leading-tight mt-0.5">{cluster.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <aside className="hidden xl:flex flex-col w-72 flex-shrink-0 border-l border-border/60 bg-card/20 overflow-y-auto px-4 py-5 gap-5">
          {/* Intelligence Stats */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest">
                Intelligence Growth
              </h2>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/80 p-4">
              <Sparkline />
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-foreground">+34</p>
                  <p className="text-xs text-muted-foreground">new memories this week</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-400">+18%</p>
                  <p className="text-xs text-muted-foreground">vs last week</p>
                </div>
              </div>
            </div>
          </div>

          {/* AI Synthesis Panel */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-amber-400" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest">
                AI Synthesis
              </h2>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/80 p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                AI has identified <span className="font-semibold text-foreground">3 critical patterns:</span>
              </p>
              {AI_PATTERNS.map((pattern) => {
                const pc = priorityConfig(pattern.priority);
                return (
                  <div
                    key={pattern.id}
                    className="rounded-lg border border-border/40 bg-muted/30 p-3 space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${pc.dot}`} />
                      <span className={`text-xs font-semibold ${pc.text}`}>{pc.label}</span>
                    </div>
                    <p className="text-xs font-medium text-foreground pl-4">{pattern.label}</p>
                    <p className="text-xs text-muted-foreground pl-4 leading-relaxed">
                      {pattern.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Tags */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Tag className="h-4 w-4 text-blue-400" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest">
                Top Tags
              </h2>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/80 p-4">
              <div className="flex flex-wrap gap-1.5">
                {TOP_TAGS.map((tag) => {
                  // weight 4-9 → text-xs to text-sm, opacity 60%-100%
                  const size = tag.weight >= 8 ? "text-sm" : tag.weight >= 6 ? "text-xs" : "text-xs";
                  const opacity = tag.weight >= 8 ? "opacity-100" : tag.weight >= 6 ? "opacity-80" : "opacity-60";
                  const fw = tag.weight >= 8 ? "font-semibold" : "font-medium";
                  return (
                    <button
                      key={tag.label}
                      onClick={() => setSearchQuery(tag.label)}
                      className={`${size} ${opacity} ${fw} text-muted-foreground hover:text-foreground hover:opacity-100 transition-all px-2 py-0.5 rounded-md hover:bg-muted/60`}
                    >
                      #{tag.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Memory Health */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-violet-400" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest">
                Memory Health
              </h2>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/80 p-4 space-y-2.5">
              {[
                { label: "High Confidence", value: 37, color: "bg-emerald-500" },
                { label: "Medium Confidence", value: 41, color: "bg-amber-500" },
                { label: "Low Confidence", value: 22, color: "bg-red-500" },
              ].map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className="text-xs font-semibold text-foreground">{row.value}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${row.color}`}
                      style={{ width: `${row.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
