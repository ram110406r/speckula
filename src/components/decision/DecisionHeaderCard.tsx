import React from "react";
import { Lightbulb, TrendingUp, TrendingDown, Minus, AlertTriangle, Target } from "lucide-react";
import type { OpportunityScoreHistoryEntry } from "@/lib/ai/scoreHistory";

interface DecisionHeaderCardProps {
  score: number;
  impact: number;
  effort: number;
  confidence: number;
  demand: number;
  reasoning: string;
  priority?: "high" | "medium" | "low";
  title?: string;
  history: OpportunityScoreHistoryEntry[];
  keyInsight?: string;
  recommendation?: string;
}

type StrengthBand = "strong" | "moderate" | "risky";

function bandFromScore(score: number): { band: StrengthBand; label: string; pillCls: string; dotCls: string } {
  if (score >= 70) {
    return {
      band: "strong",
      label: "Strong Decision",
      pillCls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      dotCls: "bg-emerald-500",
    };
  }
  if (score >= 45) {
    return {
      band: "moderate",
      label: "Moderate",
      pillCls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      dotCls: "bg-amber-500",
    };
  }
  return {
    band: "risky",
    label: "Risky Decision",
    pillCls: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
    dotCls: "bg-red-500",
  };
}

const priorityBadgeStyles: Record<NonNullable<DecisionHeaderCardProps["priority"]>, string> = {
  high: "border-primary/30 bg-primary/10 text-primary",
  medium: "border-border bg-muted/30 text-muted-foreground",
  low: "border-border/40 bg-transparent text-muted-foreground/70",
};

export function DecisionHeaderCard({
  score,
  impact,
  effort,
  confidence,
  demand,
  reasoning,
  priority,
  title,
  history,
  keyInsight,
  recommendation,
}: DecisionHeaderCardProps) {
  const overcommitWarning = priority === "high" && confidence < 5;
  const { label, pillCls, dotCls } = bandFromScore(score);
  const visibleHistory = history.slice(-12);
  const previousScore = visibleHistory.length > 1 ? visibleHistory[visibleHistory.length - 2].score : null;
  const delta = previousScore !== null ? score - previousScore : 0;
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendCls = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-muted-foreground";
  const max = Math.max(100, ...visibleHistory.map((entry) => entry.score));

  const metrics: ReadonlyArray<readonly [string, number]> = [
    ["Impact", impact],
    ["Effort", effort],
    ["Confidence", confidence],
    ["Demand", demand],
  ];

  return (
    <section className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${pillCls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
            <span className="font-mono tabular-nums">{score}</span>
            <span>·</span>
            <span>{label}</span>
          </span>
          {previousScore !== null && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${trendCls}`}>
              <TrendIcon className="h-3.5 w-3.5" />
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
        </div>

        {priority && (
          <span className={`shrink-0 rounded border px-2 py-0.5 text-[11px] uppercase tracking-[0.06em] font-medium ${priorityBadgeStyles[priority]}`}>
            {priority}
          </span>
        )}
      </header>

      {title && (
        <h2 className="mt-4 truncate text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
      )}

      {reasoning && (
        <div className="mt-3 flex items-start gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {reasoning}
          </p>
        </div>
      )}

      {(keyInsight || recommendation) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {keyInsight && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] font-semibold text-red-700 dark:text-red-300">
                <AlertTriangle className="h-3 w-3" />
                Key Insight
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-red-900/90 dark:text-red-100/90">
                {keyInsight}
              </p>
            </div>
          )}
          {recommendation && (
            <div className="rounded-lg border border-primary/25 bg-primary/[0.05] p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] font-semibold text-primary">
                <Target className="h-3 w-3" />
                Suggested Action
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
                {recommendation}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="my-5 h-px bg-border/60" />

      <dl className="grid grid-cols-4 gap-3">
        {metrics.map(([label, value]) => {
          const isLowConfidence = label === "Confidence" && value < 5;
          return (
            <div
              key={label}
              className={`rounded-lg border px-3 py-2 ${
                isLowConfidence
                  ? "border-red-500/30 bg-red-500/[0.05]"
                  : "border-border/40 bg-muted/20"
              }`}
            >
              <dt className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">{label}</dt>
              <dd
                className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${
                  isLowConfidence ? "text-red-700 dark:text-red-300" : "text-foreground"
                }`}
              >
                {value}<span className="text-muted-foreground/60">/10</span>
              </dd>
            </div>
          );
        })}
      </dl>

      {overcommitWarning && (
        <div className="mt-4 flex items-start gap-2 rounded-md border-l-2 border-l-red-500 bg-red-500/[0.04] px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
          <p className="text-xs leading-relaxed font-medium text-red-800 dark:text-red-200">
            High-priority decision with low confidence. Major product risk — validate before committing.
          </p>
        </div>
      )}

      {visibleHistory.length > 1 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Score Trend</span>
            <span className="text-[10px] text-muted-foreground/70 tabular-nums">{visibleHistory.length} runs</span>
          </div>
          <div className="flex h-10 items-end gap-1">
            {visibleHistory.map((entry, index) => (
              <div
                key={`${entry.timestamp}-${index}`}
                className="flex-1 rounded-sm bg-primary/70"
                style={{ height: `${Math.max(8, (entry.score / max) * 100)}%` }}
                title={`Score ${entry.score}`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
