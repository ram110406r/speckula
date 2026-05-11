"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ItemStatus = "in_progress" | "planned" | "backlog";
type ItemPriority = "critical" | "high" | "medium" | "low";
type Quarter = "Q2 2026" | "Q3 2026" | "Q4 2026" | "Q1 2027";

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  quarter: Quarter;
  status: ItemStatus;
  priority: ItemPriority;
  progress: number;
  aiScore: number;
  dependencies: string[];
  tags: string[];
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    id: "1",
    title: "Browser Extension v2",
    description: "AI-powered page analysis, competitor detection, auto-capture",
    quarter: "Q2 2026",
    status: "in_progress",
    priority: "critical",
    progress: 67,
    aiScore: 94,
    dependencies: [],
    tags: ["extension", "ai", "growth"],
  },
  {
    id: "2",
    title: "Product Brain Memory Graph",
    description: "Visual knowledge graph connecting all startup memories and insights",
    quarter: "Q2 2026",
    status: "in_progress",
    priority: "high",
    progress: 34,
    aiScore: 89,
    dependencies: ["1"],
    tags: ["product-brain", "ai", "visualization"],
  },
  {
    id: "3",
    title: "Autonomous Market Monitoring",
    description: "AI agents that continuously scan market and surface alerts",
    quarter: "Q3 2026",
    status: "planned",
    priority: "critical",
    progress: 0,
    aiScore: 96,
    dependencies: ["2"],
    tags: ["agents", "autonomous", "market"],
  },
  {
    id: "4",
    title: "Freemium Launch",
    description: "Free tier with extension + limited Product Brain + upgrade prompts",
    quarter: "Q2 2026",
    status: "in_progress",
    priority: "critical",
    progress: 78,
    aiScore: 91,
    dependencies: ["1"],
    tags: ["growth", "pricing", "launch"],
  },
  {
    id: "5",
    title: "Competitor Intelligence Dashboard",
    description: "Real-time competitor monitoring with pricing and feature tracking",
    quarter: "Q3 2026",
    status: "planned",
    priority: "high",
    progress: 0,
    aiScore: 87,
    dependencies: ["3"],
    tags: ["competitors", "intelligence"],
  },
  {
    id: "6",
    title: "Team Workspace & Collaboration",
    description: "Multi-user workspace, shared memories, collaborative decisions",
    quarter: "Q4 2026",
    status: "planned",
    priority: "medium",
    progress: 0,
    aiScore: 78,
    dependencies: ["4", "2"],
    tags: ["collaboration", "team"],
  },
  {
    id: "7",
    title: "API & Integrations Platform",
    description: "Public API, Slack integration, Jira sync, webhook system",
    quarter: "Q4 2026",
    status: "planned",
    priority: "medium",
    progress: 0,
    aiScore: 72,
    dependencies: ["4"],
    tags: ["api", "integrations"],
  },
  {
    id: "8",
    title: "Enterprise SSO & Security",
    description: "SAML/SSO, audit logs, data residency, SOC2 preparation",
    quarter: "Q1 2027",
    status: "backlog",
    priority: "low",
    progress: 0,
    aiScore: 65,
    dependencies: ["6"],
    tags: ["enterprise", "security"],
  },
];

const AI_RECOMMENDATIONS = [
  {
    id: "1",
    text: "Ship Extension v2 first — it's your acquisition moat",
    score: 94,
    icon: Target,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    id: "2",
    text: "Freemium launch depends on Extension — sequence is correct",
    score: 91,
    icon: CheckCircle2,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    id: "3",
    text: "Memory Graph unlocks Product Brain value — prioritize in Q2",
    score: 89,
    icon: Lightbulb,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
];

const QUARTERS: Quarter[] = ["Q2 2026", "Q3 2026", "Q4 2026", "Q1 2027"];

// ---------------------------------------------------------------------------
// Config maps
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
  backlog: {
    label: "Backlog",
    color: "text-muted-foreground",
    bg: "bg-muted/40 border-border",
    dot: "bg-muted-foreground/50",
  },
};

const PRIORITY_CONFIG: Record<ItemPriority, { label: string; color: string; bg: string }> = {
  critical: { label: "Critical", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  high: { label: "High", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  medium: { label: "Medium", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  low: { label: "Low", color: "text-muted-foreground", bg: "bg-muted/40 border-border" },
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
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: ItemPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
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
      {/* Header badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={item.status} />
        <PriorityBadge priority={item.priority} />
        <div className="ml-auto">
          <AIScoreBadge score={item.aiScore} />
        </div>
      </div>

      {/* Title + description */}
      <div className="space-y-1">
        <h3 className="text-[13.5px] font-semibold text-foreground leading-snug">{item.title}</h3>
        <p className="text-[12px] text-muted-foreground leading-snug">{item.description}</p>
      </div>

      {/* Progress bar */}
      <ProgressBar progress={item.progress} status={item.status} />

      {/* Tags */}
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

      {/* Dependencies */}
      {depNames.length > 0 && (
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Link2 className="h-3 w-3 mt-0.5 shrink-0" />
          <span>Depends on: {depNames.join(", ")}</span>
        </div>
      )}

      {/* Footer action */}
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
  isActive,
}: {
  quarter: Quarter;
  items: RoadmapItem[];
  allItems: RoadmapItem[];
  isActive: boolean;
}) {
  const inProgress = items.filter((i) => i.status === "in_progress").length;
  const criticalCount = items.filter((i) => i.priority === "critical").length;

  return (
    <div className={`space-y-4 ${!isActive ? "opacity-40 pointer-events-none" : ""}`}>
      {/* Quarter header */}
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
          {criticalCount > 0 && (
            <span className="text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
              {criticalCount} critical
            </span>
          )}
        </div>
        <div className="flex-1 h-px bg-border/50" />
      </div>

      {/* Items grid */}
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
// Main component
// ---------------------------------------------------------------------------

export function RoadmapsView() {
  const [activeQuarter, setActiveQuarter] = useState<Quarter | "all">("all");

  const inProgress = ROADMAP_ITEMS.filter((i) => i.status === "in_progress").length;
  const planned = ROADMAP_ITEMS.filter((i) => i.status === "planned").length;
  const avgScore = Math.round(
    ROADMAP_ITEMS.reduce((sum, i) => sum + i.aiScore, 0) / ROADMAP_ITEMS.length
  );

  const itemsByQuarter = (q: Quarter) =>
    ROADMAP_ITEMS.filter((i) => i.quarter === q);

  const isQuarterVisible = (q: Quarter) =>
    activeQuarter === "all" || activeQuarter === q;

  return (
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

          {/* Quarter selector */}
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
            {QUARTERS.map((q) => (
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
        </div>

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
          <MetricCard label="Planned" value={planned} sub="upcoming" />
          <MetricCard label="Total Items" value={ROADMAP_ITEMS.length} sub="on roadmap" />
          <MetricCard label="Avg AI Score" value={avgScore} sub="confidence avg" />
        </div>

        {/* Main content: timeline + sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">

          {/* Timeline */}
          <div className="space-y-8">
            {QUARTERS.map((q) => {
              const items = itemsByQuarter(q);
              if (items.length === 0) return null;
              return (
                <QuarterSection
                  key={q}
                  quarter={q}
                  items={items}
                  allItems={ROADMAP_ITEMS}
                  isActive={isQuarterVisible(q)}
                />
              );
            })}
          </div>

          {/* AI Recommendations sidebar */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-4">
              <div className="px-4 py-3.5 border-b border-border flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-[13px] font-semibold text-foreground">AI Recommendations</span>
              </div>
              <div className="p-4 space-y-3">
                {AI_RECOMMENDATIONS.map((rec) => {
                  const Icon = rec.icon;
                  return (
                    <div
                      key={rec.id}
                      className={`rounded-lg border p-3.5 space-y-2 ${rec.bg}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${rec.color}`} />
                        <p className="text-[12px] text-foreground leading-snug">{rec.text}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold tabular-nums ${rec.color}`}>{rec.score}</span>
                        <div className="flex-1 h-1 rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              rec.score >= 90 ? "bg-emerald-500" : rec.score >= 80 ? "bg-blue-500" : "bg-amber-500"
                            }`}
                            style={{ width: `${rec.score}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">confidence</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Milestone overview */}
              <div className="px-4 pb-4 pt-1 border-t border-border mt-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 mt-3">
                  Milestone Overview
                </p>
                <div className="space-y-2.5">
                  {QUARTERS.map((q) => {
                    const qItems = itemsByQuarter(q);
                    const done = qItems.filter((i) => i.status === "in_progress").length;
                    const pct = qItems.length > 0 ? Math.round((done / qItems.length) * 100) : 0;
                    return (
                      <div key={q} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground font-medium">{q}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground tabular-nums">{qItems.length} items</span>
                            {pct > 0 && (
                              <span className="text-blue-400 font-semibold flex items-center gap-0.5">
                                <TrendingUp className="h-2.5 w-2.5" />
                                {pct}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Critical path alert */}
              <div className="mx-4 mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-semibold text-amber-400">Critical Path</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Extension v2 → Freemium → Team Collab is your growth chain. Don&apos;t reorder.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="mx-4 mb-4 grid grid-cols-2 gap-2">
                <div className="bg-muted/30 rounded-lg p-2.5 text-center border border-border/50">
                  <div className="text-[18px] font-bold text-foreground tabular-nums leading-none">
                    {ROADMAP_ITEMS.filter((i) => i.priority === "critical").length}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">Critical items</div>
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

        {/* Bottom: dependency map summary */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Dependency Chain
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            {ROADMAP_ITEMS.filter((i) => i.dependencies.length > 0).map((item) => {
              const depTitles = item.dependencies
                .map((d) => ROADMAP_ITEMS.find((r) => r.id === d)?.title ?? d)
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

      </div>
    </div>
  );
}
