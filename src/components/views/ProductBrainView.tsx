"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Brain, BookOpen, Compass, AlertTriangle, Lightbulb, FlaskConical,
  Search, Plus, X, ChevronDown, ChevronUp, Link2, Tag, Zap,
  TrendingUp, Database, Shield, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useProductBrain, type ProductBrainEntry } from "@/hooks/useProductBrain";

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

// ─── Entry type mappings ─────────────────────────────────────────────────────

const ENTRY_TYPE_TO_MEMORY_TYPE: Record<string, MemoryType> = {
  competitor_insight:  "insight",
  market_signal:       "learning",
  pm_insight:          "insight",
  pricing_observation: "assumption",
  onboarding_pattern:  "learning",
  feature_comparison:  "insight",
  strategic_decision:  "decision",
  ux_friction:         "learning",
  icp_inference:       "assumption",
};

const ENTRY_TYPE_TO_CATEGORY: Record<string, MemoryCategory> = {
  competitor_insight:  "competitor",
  market_signal:       "market",
  pm_insight:          "product",
  pricing_observation: "strategy",
  onboarding_pattern:  "growth",
  feature_comparison:  "competitor",
  strategic_decision:  "strategy",
  ux_friction:         "product",
  icp_inference:       "market",
};

const MEMORY_TYPE_TO_ENTRY_TYPE: Record<MemoryType, string> = {
  learning:   "market_signal",
  decision:   "strategic_decision",
  assumption: "icp_inference",
  insight:    "pm_insight",
  experiment: "market_signal",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function mapEntry(e: ProductBrainEntry): Memory {
  return {
    id:          e.id,
    type:        ENTRY_TYPE_TO_MEMORY_TYPE[e.entryType] ?? "insight",
    category:    ENTRY_TYPE_TO_CATEGORY[e.entryType]    ?? "product",
    title:       e.title,
    content:     e.content,
    tags:        e.tags,
    confidence:  Math.round((e.confidence ?? 0) * 100),
    source:      e.sourceUrl ? new URL(e.sourceUrl).hostname : e.entryType.replace(/_/g, " "),
    createdAt:   e.createdAt,
    connections: 0,
  };
}

// ─── Config ──────────────────────────────────────────────────────────────────

const FILTER_TABS: { label: string; value: MemoryType | "all" }[] = [
  { label: "All",         value: "all"        },
  { label: "Learnings",   value: "learning"   },
  { label: "Decisions",   value: "decision"   },
  { label: "Assumptions", value: "assumption" },
  { label: "Insights",    value: "insight"    },
  { label: "Experiments", value: "experiment" },
];

const TYPE_CONFIG: Record<MemoryType, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
  learning:   { icon: BookOpen,      color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", label: "Learning"   },
  decision:   { icon: Compass,       color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    label: "Decision"   },
  assumption: { icon: AlertTriangle, color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   label: "Assumption" },
  insight:    { icon: Lightbulb,     color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30",  label: "Insight"    },
  experiment: { icon: FlaskConical,  color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30",  label: "Experiment" },
};

const CATEGORY_CONFIG: Record<MemoryCategory, { bg: string; text: string }> = {
  market:     { bg: "bg-sky-500/10",    text: "text-sky-400"    },
  product:    { bg: "bg-violet-500/10", text: "text-violet-400" },
  strategy:   { bg: "bg-teal-500/10",   text: "text-teal-400"   },
  competitor: { bg: "bg-rose-500/10",   text: "text-rose-400"   },
  growth:     { bg: "bg-lime-500/10",   text: "text-lime-400"   },
};

function confidenceColor(n: number) {
  if (n >= 80) return { bar: "bg-emerald-500", text: "text-emerald-400" };
  if (n >= 60) return { bar: "bg-amber-500",   text: "text-amber-400"   };
  return              { bar: "bg-red-500",      text: "text-red-400"     };
}


// ─── Memory Card ─────────────────────────────────────────────────────────────

function MemoryCard({ memory, expanded, onToggleExpand }: {
  memory: Memory; expanded: boolean; onToggleExpand: (id: string) => void;
}) {
  const tc = TYPE_CONFIG[memory.type];
  const cc = CATEGORY_CONFIG[memory.category];
  const conf = confidenceColor(memory.confidence);
  const Icon = tc.icon;

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 hover:bg-card transition-all duration-200 hover:border-border hover:shadow-md overflow-hidden">
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex-shrink-0 rounded-lg p-2 ${tc.bg} ${tc.border} border`}>
            <Icon className={`h-4 w-4 ${tc.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-xs font-medium ${tc.color}`}>{tc.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cc.bg} ${cc.text}`}>{memory.category}</span>
            </div>
            <h3 className="text-sm font-semibold text-foreground leading-snug mb-2">{memory.title}</h3>
            <p className={`text-xs text-muted-foreground leading-relaxed transition-all ${expanded ? "" : "line-clamp-3"}`}>
              {memory.content}
            </p>
            <button
              onClick={() => onToggleExpand(memory.id)}
              className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Read more</>}
            </button>
          </div>
        </div>
        {memory.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pl-11">
            {memory.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-muted/60 text-muted-foreground border border-border/40">
                <Tag className="h-2.5 w-2.5" />{tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-t border-border/40 bg-muted/20">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[160px]">
            <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden flex-shrink-0">
              <div className={`h-full rounded-full ${conf.bar} transition-all`} style={{ width: `${memory.confidence}%` }} />
            </div>
            <span className={`text-xs font-semibold ${conf.text}`}>{memory.confidence}%</span>
            <span className="text-xs text-muted-foreground/60">confidence</span>
          </div>
          <span className="text-xs text-muted-foreground/60 hidden sm:block">{memory.source}</span>
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Link2 className="h-3 w-3" />{memory.connections} connections
          </button>
          <span className="text-xs text-muted-foreground/50">{relativeTime(memory.createdAt)}</span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs ml-auto">Related</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, sub, iconColor }: {
  icon: React.ElementType; label: string; value: string; sub?: string; iconColor: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/80 px-4 py-3 flex items-center gap-3">
      <div className="rounded-lg p-2 bg-muted/60">
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

function AddMemoryForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<MemoryType>("learning");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = useCallback(async () => {
    if (!user || !title.trim()) return;
    setSaving(true);
    try {
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
      onSaved();
      onClose();
    } catch {
      // non-fatal
    } finally {
      setSaving(false);
    }
  }, [user, title, content, type, onSaved, onClose]);

  return (
    <div className="rounded-xl border border-border bg-card/90 p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" /> New Memory
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(TYPE_CONFIG) as MemoryType[]).map((t) => {
          const tc = TYPE_CONFIG[t];
          const Icon = tc.icon;
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                type === t ? `${tc.bg} ${tc.color} ${tc.border}` : "border-border/40 text-muted-foreground hover:border-border"
              }`}
            >
              <Icon className="h-3 w-3" />{tc.label}
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
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 px-3 text-xs">Cancel</Button>
        <Button size="sm" className="h-7 px-3 text-xs" disabled={!title.trim() || saving} onClick={handleSave}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Memory"}
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

  const debouncedSearch = useDebounce(searchQuery, 400);

  const { data, loading, error, refetch } = useProductBrain(undefined, debouncedSearch || undefined);

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

  const allMemories: Memory[] = (data?.entries ?? []).map(mapEntry);
  const total = data?.total ?? allMemories.length;

  const filtered = allMemories.filter((m) =>
    activeType === "all" || m.type === activeType
  );

  // Derived stats
  const highConfidence = allMemories.filter((m) => m.confidence >= 80).length;
  const lowConfidence  = allMemories.filter((m) => m.confidence < 60).length;
  const medConfidence  = allMemories.length - highConfidence - lowConfidence;

  // Tag frequency cloud
  const tagCounts: Record<string, number> = {};
  for (const m of allMemories) {
    for (const t of m.tags) {
      tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  // Per-type counts for filter tabs
  const typeCounts: Record<MemoryType, number> = {
    learning: 0, decision: 0, assumption: 0, insight: 0, experiment: 0,
  };
  for (const m of allMemories) typeCounts[m.type]++;

  // Memory network category counts
  const categoryCounts: Record<MemoryCategory, number> = {
    market: 0, product: 0, strategy: 0, competitor: 0, growth: 0,
  };
  for (const m of allMemories) categoryCounts[m.category]++;

  const networkClusters = [
    { label: "Market Intelligence", count: categoryCounts.market,     color: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/30"    },
    { label: "Product Decisions",   count: categoryCounts.product,    color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/30" },
    { label: "Growth Experiments",  count: categoryCounts.growth,     color: "text-lime-400",   bg: "bg-lime-500/10",   border: "border-lime-500/30"   },
    { label: "Competitor Insights", count: categoryCounts.competitor, color: "text-rose-400",   bg: "bg-rose-500/10",   border: "border-rose-500/30"   },
    { label: "Strategy Assumptions",count: categoryCounts.strategy,   color: "text-teal-400",   bg: "bg-teal-500/10",   border: "border-teal-500/30"   },
  ];

  const highPct = total > 0 ? Math.round((highConfidence / total) * 100) : 0;
  const medPct  = total > 0 ? Math.round((medConfidence  / total) * 100) : 0;
  const lowPct  = total > 0 ? Math.round((lowConfidence  / total) * 100) : 0;

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
              {loading ? "Loading…" : `${total} ${total === 1 ? "memory" : "memories"}`} ·{" "}
              <span className="text-violet-400 font-medium">AI-indexed</span>
            </p>
          </div>
          <Button
            onClick={() => setShowAddForm((v) => !v)}
            size="sm"
            className="flex-shrink-0 h-8 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white border-0"
          >
            <Plus className="h-4 w-4" /> Add Memory
          </Button>
        </div>

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
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-mono bg-muted border border-border/60 text-muted-foreground/60">⌘K</kbd>
          </div>
        </div>

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
                <span className="ml-1.5 opacity-60">{typeCounts[tab.value]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Main Feed ── */}
        <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard icon={Database}      label="Total Memories"     value={String(total)}                                        iconColor="text-violet-400" />
            <MetricCard icon={Shield}        label="High Confidence"    value={String(highConfidence)} sub={`${highPct}% of total`}  iconColor="text-emerald-400" />
            <MetricCard icon={AlertTriangle} label="Low Confidence"     value={String(lowConfidence)}  sub="Need attention"          iconColor="text-amber-400" />
            <MetricCard icon={Link2}         label="Entries loaded"     value={String(allMemories.length)}                           iconColor="text-blue-400" />
          </div>

          {showAddForm && <AddMemoryForm onClose={() => setShowAddForm(false)} onSaved={refetch} />}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}
            </div>
          )}

          {searchQuery && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {filtered.length === 0
                  ? "No memories found"
                  : `${filtered.length} result${filtered.length !== 1 ? "s" : ""} for "${searchQuery}"`}
              </span>
              <button onClick={() => setSearchQuery("")} className="text-xs hover:text-foreground transition-colors">Clear</button>
            </div>
          )}

          <div className="space-y-3">
            {loading && allMemories.length === 0 ? (
              <div className="py-16 text-center">
                <Loader2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3 animate-spin" />
                <p className="text-sm text-muted-foreground">Loading memories…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Brain className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "No memories match your search." : "No memories yet. Add your first one."}
                </p>
                {(searchQuery || activeType !== "all") && (
                  <button
                    onClick={() => { setSearchQuery(""); setActiveType("all"); }}
                    className="mt-2 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              filtered.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  expanded={expandedId === memory.id}
                  onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
                />
              ))
            )}
          </div>

          {/* Memory Network */}
          <div className="rounded-xl border border-border/60 bg-card/60 p-5 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-foreground">Memory Network</h2>
              <span className="ml-auto text-xs text-muted-foreground/60">{allMemories.length} active entries</span>
            </div>
            <div className="relative flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/40 shadow-sm">
                <Brain className="h-4 w-4 text-violet-400" />
                <span className="text-sm font-semibold text-violet-300">SPECKULA Core</span>
              </div>
              <div className="w-px h-4 bg-border/60" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full">
                {networkClusters.map((cluster) => (
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
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest">Intelligence</h2>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/80 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-foreground">{total}</p>
                  <p className="text-xs text-muted-foreground">total memories</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-400">{highPct}%</p>
                  <p className="text-xs text-muted-foreground">high confidence</p>
                </div>
              </div>
            </div>
          </div>

          {topTags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Tag className="h-4 w-4 text-blue-400" />
                <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest">Top Tags</h2>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/80 p-4">
                <div className="flex flex-wrap gap-1.5">
                  {topTags.map(([tag, count]) => {
                    const size    = count >= 4 ? "text-sm" : "text-xs";
                    const opacity = count >= 4 ? "opacity-100" : count >= 2 ? "opacity-80" : "opacity-60";
                    const fw      = count >= 4 ? "font-semibold" : "font-medium";
                    return (
                      <button
                        key={tag}
                        onClick={() => setSearchQuery(tag)}
                        className={`${size} ${opacity} ${fw} text-muted-foreground hover:text-foreground hover:opacity-100 transition-all px-2 py-0.5 rounded-md hover:bg-muted/60`}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-violet-400" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-widest">Memory Health</h2>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/80 p-4 space-y-2.5">
              {[
                { label: "High Confidence",   value: highPct, color: "bg-emerald-500" },
                { label: "Medium Confidence", value: medPct,  color: "bg-amber-500"   },
                { label: "Low Confidence",    value: lowPct,  color: "bg-red-500"     },
              ].map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className="text-xs font-semibold text-foreground">{row.value}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.value}%` }} />
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

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
