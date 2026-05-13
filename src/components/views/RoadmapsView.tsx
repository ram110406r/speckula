"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  GitBranch,
  ChevronRight,
  Brain,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Tag,
  Link2,
  Layers,
  Target,
  TrendingUp,
  Lightbulb,
  Calendar,
  Loader2,
  PackageOpen,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/useApi";
import { useExtensionPreferences } from "@/hooks/useExtensionPreferences";
import { useAuth } from "@/lib/firebase/AuthProvider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ItemStatus = "in_progress" | "planned" | "completed" | "dropped" | "backlog";
type ItemPriority = "high" | "medium" | "low";

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  quarter: string;
  status: ItemStatus;
  priority: ItemPriority;
  progress: number;
  aiScore: number;       // 0–100 (scaled from 0–1 backend float)
  aiRationale: string | null;
  dependencies: string[];
  tags: string[];
}

// Shape returned by GET /roadmaps
interface ApiRoadmapItem {
  id: string;
  title: string;
  description: string | null;
  quarter: string;
  status: string;
  priority: string;
  aiScore: number | null;   // 0–1 float from backend
  aiRationale: string | null;
  dependsOn: string | null; // JSON string
  tags: string | null;      // JSON string
  progress: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

function transformItem(api: ApiRoadmapItem): RoadmapItem {
  return {
    id: api.id,
    title: api.title,
    description: api.description ?? "",
    quarter: api.quarter,
    status: api.status as ItemStatus,
    priority: (api.priority as ItemPriority) ?? "medium",
    progress: api.progress ?? 0,
    aiScore: Math.round((api.aiScore ?? 0) * 100),
    aiRationale: api.aiRationale ?? null,
    dependencies: tryParse<string[]>(api.dependsOn, []),
    tags: tryParse<string[]>(api.tags, []),
  };
}

// ---------------------------------------------------------------------------
// Config maps  (UI constants — intentional, not mock data)
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<ItemStatus, { label: string; color: string; bg: string; dot: string }> = {
  in_progress: {
    label: "In Progress",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    dot: "bg-blue-500",
  },
  planned: {
    label: "Planned",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    dot: "bg-purple-500",
  },
  completed: {
    label: "Completed",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  dropped: {
    label: "Dropped",
    color: "text-muted-foreground",
    bg: "bg-muted/40 border-border",
    dot: "bg-muted-foreground/30",
  },
  backlog: {
    label: "Backlog",
    color: "text-muted-foreground",
    bg: "bg-muted/40 border-border",
    dot: "bg-muted-foreground/50",
  },
};

const PRIORITY_CONFIG: Record<ItemPriority, { label: string; color: string; bg: string }> = {
  high:   { label: "High",   color: "text-amber-400",         bg: "bg-amber-500/10 border-amber-500/20" },
  medium: { label: "Medium", color: "text-blue-400",          bg: "bg-blue-500/10 border-blue-500/20" },
  low:    { label: "Low",    color: "text-muted-foreground",  bg: "bg-muted/40 border-border" },
};

function aiScoreColor(score: number): string {
  if (score >= 90) return "text-emerald-500";
  if (score >= 80) return "text-blue-400";
  if (score >= 70) return "text-amber-400";
  return "text-muted-foreground";
}

function aiScoreBg(score: number): string {
  if (score >= 90) return "bg-emerald-500/10 border-emerald-500/20";
  if (score >= 80) return "bg-blue-500/10 border-blue-500/20";
  if (score >= 70) return "bg-amber-500/10 border-amber-500/20";
  return "bg-muted/40 border-border";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ItemStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.backlog;
  return (
    <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: ItemPriority }) {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function AIScoreBadge({ score }: { score: number }) {
  return (
    <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${aiScoreBg(score)} ${aiScoreColor(score)}`}>
      <Brain className="h-2.5 w-2.5" />
      {score}
    </span>
  );
}

function ProgressBar({ progress, status }: { progress: number; status: ItemStatus }) {
  if (status !== "in_progress" || progress === 0) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">Progress</span>
        <span className="text-[10px] font-semibold text-foreground tabular-nums">{progress}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

interface RoadmapCardProps {
  item: RoadmapItem;
  allItems: RoadmapItem[];
}

function RoadmapCard({ item, allItems }: RoadmapCardProps) {
  const depNames = item.dependencies
    .map((depId) => allItems.find((i) => i.id === depId)?.title ?? depId)
    .filter(Boolean);

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3.5 hover:border-border/80 transition-colors">
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={item.status} />
        <PriorityBadge priority={item.priority} />
        <div className="ml-auto">
          <AIScoreBadge score={item.aiScore} />
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-[13.5px] font-semibold text-foreground leading-snug">{item.title}</h3>
        <p className="text-[12px] text-muted-foreground leading-snug">{item.description}</p>
      </div>

      <ProgressBar progress={item.progress} status={item.status} />

      <div className="flex flex-wrap gap-1.5">
        {item.tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md border border-border/50"
          >
            <Tag className="h-2.5 w-2.5" />
            {tag}
          </span>
        ))}
      </div>

      {depNames.length > 0 && (
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Link2 className="h-3 w-3 mt-0.5 shrink-0" />
          <span>Depends on: {depNames.join(", ")}</span>
        </div>
      )}

      <div className="pt-1">
        <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2.5 gap-1 w-full justify-center border border-border/50">
          View Details
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function QuarterSection({
  quarter,
  items,
  allItems,
}: {
  quarter: string;
  items: RoadmapItem[];
  allItems: RoadmapItem[];
}) {
  const inProgress = items.filter((i) => i.status === "in_progress").length;
  const highCount  = items.filter((i) => i.priority === "high").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[14px] font-bold text-foreground">{quarter}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{items.length} items</span>
          {inProgress > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              {inProgress} in progress
            </span>
          )}
          {highCount > 0 && (
            <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
              {highCount} high priority
            </span>
          )}
        </div>
        <div className="flex-1 h-px bg-border/50" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((item) => (
          <RoadmapCard key={item.id} item={item} allItems={allItems} />
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold tracking-tight text-foreground leading-none">{value}</span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generate Roadmap modal
// ---------------------------------------------------------------------------

interface GenerateModalProps {
  onClose: () => void;
  onGenerate: (quarter: string, context: string) => Promise<void>;
  generating: boolean;
}

function GenerateModal({ onClose, onGenerate, generating }: GenerateModalProps) {
  const currentYear = new Date().getFullYear();
  const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${currentYear}`;

  const [quarter, setQuarter] = useState(currentQuarter);
  const [context, setContext] = useState("");
  const [quarterError, setQuarterError] = useState("");

  const QUARTER_RE = /^Q[1-4]\s\d{4}$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!QUARTER_RE.test(quarter.trim())) {
      setQuarterError('Format must be "Q1 2026"');
      return;
    }
    if (context.trim().length < 10) return;
    await onGenerate(quarter.trim(), context.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-[14px] font-semibold text-foreground">Generate AI Roadmap</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Quarter</label>
            <input
              type="text"
              value={quarter}
              onChange={(e) => { setQuarter(e.target.value); setQuarterError(""); }}
              placeholder="Q3 2026"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            {quarterError && <p className="text-[11px] text-red-400">{quarterError}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">
              Strategic context <span className="text-muted-foreground/60">(min 10 chars)</span>
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. Launch B2B tier, reduce churn, expand to APAC — describe priorities, constraints, and goals."
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right tabular-nums">{context.length} / 2000</p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="flex-1 text-[12px]" onClick={onClose} disabled={generating}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="flex-1 text-[12px] gap-1.5"
              disabled={generating || context.trim().length < 10}
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generating ? "Generating…" : "Generate"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RoadmapsView() {
  const { user } = useAuth();
  const { preferences } = useExtensionPreferences();
  const workspaceId = preferences?.activeWorkspaceId ?? null;

  const apiUrl = workspaceId
    ? `/api/roadmaps?workspaceId=${encodeURIComponent(workspaceId)}`
    : "/api/roadmaps";

  const { data, loading, error, refetch } = useApi<{ items: ApiRoadmapItem[] }>(apiUrl, {
    refreshInterval: 60_000,
  });

  const items = useMemo(() => (data?.items ?? []).map(transformItem), [data]);

  const [activeQuarter, setActiveQuarter] = useState<string>("all");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const quarters = useMemo(() => {
    const seen = new Set<string>();
    items.forEach((i) => seen.add(i.quarter));
    return Array.from(seen).sort();
  }, [items]);

  const inProgress = items.filter((i) => i.status === "in_progress").length;
  const planned    = items.filter((i) => i.status === "planned").length;
  const completed  = items.filter((i) => i.status === "completed").length;
  const avgScore   = items.length > 0
    ? Math.round(items.reduce((s, i) => s + i.aiScore, 0) / items.length)
    : 0;

  // When a quarter is selected, filter to only that quarter's items.
  const visibleItems = activeQuarter === "all"
    ? items
    : items.filter((i) => i.quarter === activeQuarter);

  const visibleQuarters = activeQuarter === "all" ? quarters : [activeQuarter];

  const itemsByQuarter = (q: string) => visibleItems.filter((i) => i.quarter === q);

  // Top-3 items by aiScore for the recommendations sidebar.
  const topItems = useMemo(
    () => [...items].sort((a, b) => b.aiScore - a.aiScore).slice(0, 3),
    [items]
  );

  const recIcons  = [Target, CheckCircle2, Lightbulb];
  const recColors = ["text-emerald-500", "text-blue-400", "text-amber-400"];
  const recBgs    = [
    "bg-emerald-500/10 border-emerald-500/20",
    "bg-blue-500/10 border-blue-500/20",
    "bg-amber-500/10 border-amber-500/20",
  ];

  const handleGenerate = useCallback(async (quarter: string, context: string) => {
    if (!user) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/roadmaps/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ quarter, context, workspaceId }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `Request failed: ${res.status}`);
      }
      setShowGenerateModal(false);
      refetch();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [user, workspaceId, refetch]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-[13px]">Loading roadmap…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <p className="text-[13px] text-foreground font-medium">Failed to load roadmap</p>
          <p className="text-[12px] text-muted-foreground">{error}</p>
          <Button size="sm" variant="outline" onClick={refetch} className="mt-1">Retry</Button>
        </div>
      </div>
    );
  }

  const hasItems = items.length > 0;

  return (
    <>
      {showGenerateModal && (
        <GenerateModal
          onClose={() => setShowGenerateModal(false)}
          onGenerate={handleGenerate}
          generating={generating}
        />
      )}

      <div className="h-full overflow-y-auto bg-background">
        <div className="max-w-[1280px] mx-auto px-5 py-6 space-y-6">

          {/* Page header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <GitBranch className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-[15px] font-semibold text-foreground leading-tight">Roadmap</h1>
                <p className="text-[11px] text-muted-foreground">AI-prioritized strategic planning</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Quarter selector */}
              {hasItems && quarters.length > 0 && (
                <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
                  <button
                    type="button"
                    onClick={() => setActiveQuarter("all")}
                    className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                      activeQuarter === "all"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    All
                  </button>
                  {quarters.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setActiveQuarter(q)}
                      className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                        activeQuarter === q
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                className="h-8 text-[11px] gap-1.5"
                onClick={() => setShowGenerateModal(true)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate AI Roadmap
              </Button>

              <Button size="sm" className="h-8 text-[11px] gap-1.5" disabled>
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>
          </div>

          {/* Generate error */}
          {generateError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {generateError}
            </div>
          )}

          {/* Empty state */}
          {!hasItems && (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-muted/40 border border-border flex items-center justify-center">
                <PackageOpen className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-foreground">No roadmap items yet</p>
                <p className="text-[12px] text-muted-foreground mt-1 max-w-xs mx-auto">
                  Generate an AI-powered quarter roadmap or add items manually.
                </p>
              </div>
              <Button
                size="sm"
                className="gap-1.5 mt-1"
                onClick={() => setShowGenerateModal(true)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate AI Roadmap
              </Button>
            </div>
          )}

          {hasItems && (
            <>
              {/* AI Score legend */}
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Brain className="h-3 w-3" />
                  <span className="font-medium">AI Score:</span>
                </div>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />90+ High confidence</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />80–89 Moderate</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />70–79 Uncertain</span>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard label="In Progress" value={inProgress} sub="this quarter" />
                <MetricCard label="Planned"     value={planned}    sub="upcoming" />
                <MetricCard label="Completed"   value={completed}  sub="shipped" />
                <MetricCard label="Avg AI Score" value={avgScore}  sub="confidence avg" />
              </div>

              {/* Main content: timeline + sidebar */}
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">

                {/* Timeline */}
                <div className="space-y-8">
                  {visibleQuarters.map((q) => {
                    const qItems = itemsByQuarter(q);
                    if (qItems.length === 0) return null;
                    return (
                      <QuarterSection
                        key={q}
                        quarter={q}
                        items={qItems}
                        allItems={items}
                      />
                    );
                  })}
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                  <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-4">
                    <div className="px-4 py-3.5 border-b border-border flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[13px] font-semibold text-foreground">Top Priorities</span>
                    </div>
                    <div className="p-4 space-y-3">
                      {topItems.length === 0 ? (
                        <p className="text-[12px] text-muted-foreground text-center py-2">No items scored yet.</p>
                      ) : (
                        topItems.map((item, idx) => {
                          const Icon  = recIcons[idx]  ?? Target;
                          const color = recColors[idx] ?? "text-muted-foreground";
                          const bg    = recBgs[idx]    ?? "bg-muted/40 border-border";
                          const text  = item.aiRationale ?? item.title;
                          return (
                            <div key={item.id} className={`rounded-lg border p-3.5 space-y-2 ${bg}`}>
                              <div className="flex items-start gap-2.5">
                                <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${color}`} />
                                <p className="text-[12px] text-foreground leading-snug">{text}</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-bold tabular-nums ${color}`}>{item.aiScore}</span>
                                <div className="flex-1 h-1 rounded-full bg-muted/60 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      item.aiScore >= 90 ? "bg-emerald-500" : item.aiScore >= 80 ? "bg-blue-500" : "bg-amber-500"
                                    }`}
                                    style={{ width: `${item.aiScore}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground">confidence</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Milestone overview */}
                    <div className="px-4 pb-4 pt-1 border-t border-border mt-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 mt-3">
                        Milestone Overview
                      </p>
                      <div className="space-y-2.5">
                        {quarters.map((q) => {
                          const qItems = items.filter((i) => i.quarter === q);
                          // Progress = completed items / total items (not in_progress)
                          const done = qItems.filter((i) => i.status === "completed").length;
                          const pct  = qItems.length > 0 ? Math.round((done / qItems.length) * 100) : 0;
                          return (
                            <div key={q} className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => setActiveQuarter(activeQuarter === q ? "all" : q)}
                                  className="text-muted-foreground font-medium hover:text-foreground transition-colors"
                                >
                                  {q}
                                </button>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-muted-foreground tabular-nums">{qItems.length} items</span>
                                  {pct > 0 && (
                                    <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                                      <TrendingUp className="h-2.5 w-2.5" />
                                      {pct}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick stats */}
                    <div className="mx-4 mb-4 grid grid-cols-2 gap-2">
                      <div className="bg-muted/30 rounded-lg p-2.5 text-center border border-border/50">
                        <div className="text-[18px] font-bold text-foreground tabular-nums leading-none">
                          {items.filter((i) => i.priority === "high").length}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">High priority</div>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2.5 text-center border border-border/50">
                        <div className="text-[18px] font-bold text-emerald-500 tabular-nums leading-none flex items-center justify-center gap-1">
                          {avgScore}
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">Avg AI score</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dependency chain */}
              {items.some((i) => i.dependencies.length > 0) && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Dependency Chain
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    {items.filter((i) => i.dependencies.length > 0).map((item) => {
                      const depTitles = item.dependencies
                        .map((d) => items.find((r) => r.id === d)?.title ?? d)
                        .join(", ");
                      return (
                        <div key={item.id} className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-3 py-1.5 border border-border/50">
                          <span className="text-muted-foreground text-[11px]">{depTitles}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                          <span className="text-foreground font-medium text-[11px]">{item.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status breakdown — shows completed/dropped/backlog items at bottom */}
              {items.some((i) => i.status === "completed" || i.status === "dropped") && (
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-2">
                  <Clock className="h-3 w-3" />
                  <span>
                    {completed} completed ·{" "}
                    {items.filter((i) => i.status === "dropped").length} dropped
                  </span>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </>
  );
}
