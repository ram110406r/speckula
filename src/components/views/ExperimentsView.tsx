"use client";

import React, { useState } from "react";
import {
  FlaskConical,
  Brain,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Users,
  BarChart2,
  Lightbulb,
  AlertTriangle,
  BookOpen,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExperimentStatus = "running" | "completed" | "paused" | "planned";

interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  status: ExperimentStatus;
  variant_a: string;
  variant_b: string;
  metric: string;
  baseline: number;
  variant_result: number | null;
  improvement: string | null;
  confidence: number | null;
  n: number;
  started: string | null;
  aiInsight: string;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const EXPERIMENTS: Experiment[] = [
  {
    id: "1",
    name: "Onboarding Context-First vs Feature-First",
    hypothesis:
      'Showing users their "startup context" being built in real-time increases 7-day activation by 30%',
    status: "running",
    variant_a: "Feature tour (current)",
    variant_b: "Live context building",
    metric: "7-day activation rate",
    baseline: 18.3,
    variant_result: 22.5,
    improvement: "+23%",
    confidence: 89,
    n: 234,
    started: "4 days ago",
    aiInsight: "Strong signal — context-first resonates with technical founders",
  },
  {
    id: "2",
    name: 'Pricing Page CTA: "Start Free" vs "Add to Chrome"',
    hypothesis:
      '"Add to Chrome" CTA will convert better because extension is the zero-friction entry point',
    status: "running",
    variant_a: "Start Free button",
    variant_b: "Add to Chrome CTA",
    metric: "Homepage conversion",
    baseline: 4.2,
    variant_result: 7.8,
    improvement: "+86%",
    confidence: 94,
    n: 1247,
    started: "7 days ago",
    aiInsight: "Extension CTA outperforming significantly — consider making primary CTA",
  },
  {
    id: "3",
    name: "Dashboard: Signal Feed vs Metric Overview",
    hypothesis: "Showing market signals first (vs metrics) increases daily retention",
    status: "completed",
    variant_a: "Metrics overview",
    variant_b: "Signal feed first",
    metric: "D7 retention",
    baseline: 31.2,
    variant_result: 38.7,
    improvement: "+24%",
    confidence: 97,
    n: 892,
    started: "14 days ago",
    aiInsight:
      "Signals-first wins — users want intelligence, not analytics. Implement immediately.",
  },
  {
    id: "4",
    name: "Email Digest: Weekly vs Daily",
    hypothesis:
      "Daily digests will increase engagement but weekly will be preferred for reduced noise",
    status: "paused",
    variant_a: "Weekly digest (current)",
    variant_b: "Daily digest",
    metric: "Email open rate",
    baseline: 42.1,
    variant_result: 38.3,
    improvement: "-9%",
    confidence: 72,
    n: 156,
    started: "10 days ago",
    aiInsight: "Daily is worse for open rates. Weekly preferred. Pause and stick with weekly.",
  },
  {
    id: "5",
    name: "Browser Extension: Auto-capture vs Manual capture",
    hypothesis: "Auto-capture of competitor pages increases weekly signal count by 5x",
    status: "planned",
    variant_a: "Manual capture (current)",
    variant_b: "Auto-detect competitor pages",
    metric: "Weekly signals per user",
    baseline: 12,
    variant_result: null,
    improvement: null,
    confidence: null,
    n: 0,
    started: null,
    aiInsight: "High confidence hypothesis based on market research",
  },
];

const LEARNINGS = [
  {
    id: "1",
    icon: CheckCircle2,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    text: "Context-first onboarding +23% activation — shipped to production",
    status: "shipped",
  },
  {
    id: "2",
    icon: TrendingUp,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    text: "Extension CTA +86% conversion — A/B still running, high confidence",
    status: "in_progress",
  },
  {
    id: "3",
    icon: CheckCircle2,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    text: "Weekly digest preferred over daily — confirmed",
    status: "confirmed",
  },
];

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ExperimentStatus,
  { label: string; color: string; bg: string; dotClass: string; pulse: boolean }
> = {
  running: {
    label: "Running",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    dotClass: "bg-emerald-500",
    pulse: true,
  },
  completed: {
    label: "Completed",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    dotClass: "bg-blue-500",
    pulse: false,
  },
  paused: {
    label: "Paused",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    dotClass: "bg-amber-500",
    pulse: false,
  },
  planned: {
    label: "Planned",
    color: "text-muted-foreground",
    bg: "bg-muted/40 border-border",
    dotClass: "bg-muted-foreground/50",
    pulse: false,
  },
};

function confidenceColor(confidence: number): string {
  if (confidence >= 95) return "bg-emerald-500";
  if (confidence >= 85) return "bg-blue-500";
  if (confidence >= 70) return "bg-amber-500";
  return "bg-red-500";
}

function confidenceTextColor(confidence: number): string {
  if (confidence >= 95) return "text-emerald-500";
  if (confidence >= 85) return "text-blue-400";
  if (confidence >= 70) return "text-amber-400";
  return "text-red-400";
}

function improvementIsPositive(imp: string): boolean {
  return imp.startsWith("+");
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ExperimentStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass} ${cfg.pulse ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string | number;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span
        className={`text-2xl font-bold tracking-tight leading-none tabular-nums ${
          positive !== undefined
            ? positive
              ? "text-emerald-500"
              : "text-foreground"
            : "text-foreground"
        }`}
      >
        {value}
      </span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

interface ExperimentCardProps {
  experiment: Experiment;
  onToggle: (id: string) => void;
}

function ExperimentCard({ experiment, onToggle }: ExperimentCardProps) {
  const hasResults = experiment.variant_result !== null && experiment.improvement !== null;
  const isPositive = hasResults ? improvementIsPositive(experiment.improvement!) : false;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-border/80 transition-colors">
      {/* Card header */}
      <div className="px-5 py-4 border-b border-border/50 flex items-start gap-3">
        <StatusBadge status={experiment.status} />
        {experiment.started && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
            <Clock className="h-3 w-3" />
            Started {experiment.started}
          </span>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Name + hypothesis */}
        <div className="space-y-1.5">
          <h3 className="text-[14px] font-semibold text-foreground leading-snug">{experiment.name}</h3>
          <p className="text-[12px] italic text-muted-foreground leading-relaxed">{experiment.hypothesis}</p>
        </div>

        {/* Variant comparison */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/30 rounded-lg p-3.5 border border-border/50 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 rounded bg-muted border border-border">
                A · Control
              </span>
            </div>
            <p className="text-[12px] font-medium text-foreground">{experiment.variant_a}</p>
            {hasResults && (
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">{experiment.metric}</span>
                <p className="text-[16px] font-bold text-foreground tabular-nums">{experiment.baseline}%</p>
              </div>
            )}
            {!hasResults && experiment.status !== "planned" && (
              <p className="text-[12px] font-bold text-foreground tabular-nums">{experiment.baseline}{experiment.metric.includes("rate") || experiment.metric.includes("count") ? "" : ""}</p>
            )}
          </div>

          <div className={`rounded-lg p-3.5 border space-y-2 ${
            hasResults && isPositive
              ? "bg-emerald-500/5 border-emerald-500/20"
              : hasResults && !isPositive
              ? "bg-red-500/5 border-red-500/20"
              : "bg-muted/30 border-border/50"
          }`}>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                hasResults && isPositive
                  ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                  : hasResults && !isPositive
                  ? "text-red-400 bg-red-500/10 border-red-500/20"
                  : "text-muted-foreground bg-muted border-border"
              }`}>
                B · Challenger
              </span>
              {hasResults && experiment.improvement && (
                <span className={`text-[11px] font-bold ml-auto flex items-center gap-0.5 ${
                  isPositive ? "text-emerald-500" : "text-red-400"
                }`}>
                  {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {experiment.improvement}
                </span>
              )}
            </div>
            <p className="text-[12px] font-medium text-foreground">{experiment.variant_b}</p>
            {hasResults && experiment.variant_result !== null && (
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">{experiment.metric}</span>
                <p className={`text-[16px] font-bold tabular-nums ${isPositive ? "text-emerald-500" : "text-red-400"}`}>
                  {experiment.variant_result}%
                </p>
              </div>
            )}
            {experiment.status === "planned" && (
              <p className="text-[11px] text-muted-foreground italic">Not started yet</p>
            )}
          </div>
        </div>

        {/* Confidence meter */}
        {experiment.confidence !== null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-medium">Statistical Confidence</span>
              <span className={`font-bold tabular-nums ${confidenceTextColor(experiment.confidence)}`}>
                {experiment.confidence}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${confidenceColor(experiment.confidence)}`}
                style={{ width: `${experiment.confidence}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>0%</span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                95% threshold
              </span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Sample size */}
        {experiment.n > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>n = <span className="font-semibold text-foreground tabular-nums">{experiment.n.toLocaleString()}</span> participants</span>
          </div>
        )}

        {/* AI Insight */}
        <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20 px-3.5 py-3">
          <Brain className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">AI Insight</span>
            <p className="text-[12px] text-foreground leading-snug">{experiment.aiInsight}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="ghost" className="h-8 text-[11px] px-2.5 gap-1 border border-border/50">
            View Details
            <ChevronRight className="h-3 w-3" />
          </Button>

          {experiment.status === "running" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[11px] px-2.5 gap-1"
              onClick={() => onToggle(experiment.id)}
            >
              <Pause className="h-3 w-3" />
              Stop
            </Button>
          )}

          {experiment.status === "paused" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[11px] px-2.5 gap-1"
              onClick={() => onToggle(experiment.id)}
            >
              <Play className="h-3 w-3" />
              Resume
            </Button>
          )}

          {(experiment.status === "completed" || (experiment.confidence !== null && experiment.confidence >= 90)) && (
            <Button
              size="sm"
              className="h-8 text-[11px] px-3 gap-1.5 ml-auto bg-emerald-600 hover:bg-emerald-700 text-white border-0"
            >
              <Zap className="h-3 w-3" />
              Implement Winner
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Learning Loop section
// ---------------------------------------------------------------------------

function LearningLoop() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[13px] font-semibold text-foreground">Learning Loop</span>
        <span className="text-[11px] text-muted-foreground ml-1">— insights extracted and applied</span>
      </div>
      <div className="p-5 space-y-3">
        {LEARNINGS.map((learning) => {
          const Icon = learning.icon;
          return (
            <div
              key={learning.id}
              className={`flex items-start gap-3 rounded-lg border p-4 ${learning.bg}`}
            >
              <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${learning.color}`} />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-[12.5px] text-foreground leading-snug">{learning.text}</p>
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${learning.color}`}>
                  {learning.status === "shipped"
                    ? "Shipped to production"
                    : learning.status === "confirmed"
                    ? "Confirmed"
                    : "High confidence · still running"}
                </span>
              </div>
              {learning.status === "shipped" && (
                <div className="shrink-0 flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
                  <CheckCircle2 className="h-3 w-3" />
                  Live
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      <div className="px-5 pb-5">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center border border-border/50 space-y-0.5">
            <p className="text-[18px] font-bold text-emerald-500 tabular-nums leading-none">+23%</p>
            <p className="text-[10px] text-muted-foreground">Activation lift</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center border border-border/50 space-y-0.5">
            <p className="text-[18px] font-bold text-blue-400 tabular-nums leading-none flex items-center justify-center gap-0.5">
              +86%
              <ArrowUpRight className="h-3.5 w-3.5" />
            </p>
            <p className="text-[10px] text-muted-foreground">Conversion boost</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center border border-border/50 space-y-0.5">
            <p className="text-[18px] font-bold text-foreground tabular-nums leading-none">3</p>
            <p className="text-[10px] text-muted-foreground">Learnings applied</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ExperimentsView() {
  const [experiments, setExperiments] = useState<Experiment[]>(EXPERIMENTS);
  const [filter, setFilter] = useState<ExperimentStatus | "all">("all");

  const handleToggle = (id: string) => {
    setExperiments((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, status: e.status === "running" ? "paused" : e.status === "paused" ? "running" : e.status }
          : e
      )
    );
  };

  const running = experiments.filter((e) => e.status === "running").length;
  const completed = experiments.filter((e) => e.status === "completed").length;
  const paused = experiments.filter((e) => e.status === "paused").length;

  const positiveImprovements = experiments
    .filter((e) => e.improvement && improvementIsPositive(e.improvement))
    .map((e) => parseFloat(e.improvement!.replace("+", "").replace("%", "")));

  const avgImprovement =
    positiveImprovements.length > 0
      ? Math.round(positiveImprovements.reduce((a, b) => a + b, 0) / positiveImprovements.length)
      : 0;

  const filteredExperiments =
    filter === "all" ? experiments : experiments.filter((e) => e.status === filter);

  const filterOptions: Array<{ id: ExperimentStatus | "all"; label: string }> = [
    { id: "all", label: "All" },
    { id: "running", label: "Running" },
    { id: "completed", label: "Completed" },
    { id: "paused", label: "Paused" },
    { id: "planned", label: "Planned" },
  ];

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-[900px] mx-auto px-5 py-6 space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FlaskConical className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-foreground leading-tight">Experiments</h1>
              <p className="text-[11px] text-muted-foreground">Hypothesis-driven product development</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {running > 0 && (
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {running} running
              </span>
            )}
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Running" value={running} sub="active tests" />
          <MetricCard label="Completed" value={completed} sub="with results" />
          <MetricCard label="Paused" value={paused} sub="on hold" />
          <MetricCard
            label="Avg Improvement"
            value={`+${avgImprovement}%`}
            sub="positive variants"
            positive={true}
          />
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            {filterOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilter(opt.id)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                  filter === opt.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground ml-2">
            {filteredExperiments.length} experiment{filteredExperiments.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Experiment cards */}
        <div className="space-y-4">
          {filteredExperiments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/60 rounded-2xl bg-card/40">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <FlaskConical className="h-5 w-5 text-primary" />
              </div>
              <p className="text-[13px] font-semibold text-foreground">No experiments found</p>
              <p className="text-[11px] text-muted-foreground mt-1">Try a different filter</p>
            </div>
          ) : (
            filteredExperiments.map((experiment) => (
              <ExperimentCard
                key={experiment.id}
                experiment={experiment}
                onToggle={handleToggle}
              />
            ))
          )}
        </div>

        {/* Experiment health summary */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Experiment Health
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-bold text-foreground tabular-nums leading-none">
                  {experiments.reduce((sum, e) => sum + e.n, 0).toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Total Participants</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-bold text-emerald-500 tabular-nums leading-none">
                  {experiments.filter((e) => e.confidence !== null && e.confidence >= 90).length}
                </span>
                <span className="text-[11px] text-muted-foreground">of {experiments.filter((e) => e.confidence !== null).length}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">High Confidence</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-bold text-foreground tabular-nums leading-none">
                  {experiments.filter((e) => e.improvement && improvementIsPositive(e.improvement)).length}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Positive Results</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-bold text-emerald-500 tabular-nums leading-none flex items-center gap-1">
                  +{avgImprovement}%
                  <TrendingUp className="h-4 w-4" />
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Avg Uplift</p>
            </div>
          </div>
        </div>

        {/* Learning loop */}
        <LearningLoop />

        {/* AI hypothesis generator prompt */}
        <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-[13px] font-semibold text-foreground">Ready to generate hypotheses?</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              SPECKULA&apos;s AI can generate high-confidence experiment hypotheses from your Product Brain data — competitor signals, user research, and market trends.
            </p>
          </div>
          <Button size="sm" className="shrink-0 gap-1.5 h-8 text-[11px]">
            <Lightbulb className="h-3.5 w-3.5" />
            Generate Hypotheses
          </Button>
        </div>

        {/* Upcoming experiments */}
        {experiments.filter((e) => e.status === "planned").length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[13px] font-semibold text-foreground">Planned Experiments</span>
              <span className="text-[11px] text-muted-foreground ml-1">
                — {experiments.filter((e) => e.status === "planned").length} queued
              </span>
            </div>
            <ul>
              {experiments
                .filter((e) => e.status === "planned")
                .map((exp, idx, arr) => (
                  <li
                    key={exp.id}
                    className={`flex items-start gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors ${
                      idx < arr.length - 1 ? "border-b border-border/50" : ""
                    }`}
                  >
                    <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <FlaskConical className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-[12.5px] font-medium text-foreground">{exp.name}</p>
                      <p className="text-[11.5px] text-muted-foreground leading-snug">{exp.metric}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 border border-border/50 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Not started
                      </span>
                      <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2 gap-1">
                        Launch
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  );
}
