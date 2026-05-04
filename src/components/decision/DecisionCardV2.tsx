import React from "react";
import { Sparkles, Loader2, ArrowRight, AlertTriangle, AlertCircle, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIInsight } from "@/components/ui/AIInsight";
import type { HealthStatus, Pushback, PushbackAction } from "@/lib/ai/decisionHealth";

// ─── Style maps ───────────────────────────────────────────────────────────────

const HEALTH_STYLES: Record<
  HealthStatus,
  {
    pillCls: string;
    dotCls: string;
    label: string;
    scoreCls: string;
    scoreBg: string;
    topBorderCls: string;
  }
> = {
  healthy: {
    pillCls: "border-success/30 bg-success/10 text-success",
    dotCls: "bg-success",
    label: "Strong",
    scoreCls: "text-success",
    scoreBg: "bg-success/10",
    topBorderCls: "bg-success",
  },
  risky: {
    pillCls: "border-warning/40 bg-warning/10 text-warning",
    dotCls: "bg-warning",
    label: "Risky",
    scoreCls: "text-warning",
    scoreBg: "bg-warning/10",
    topBorderCls: "bg-warning",
  },
  weak: {
    pillCls: "border-destructive/40 bg-destructive/10 text-destructive",
    dotCls: "bg-destructive",
    label: "Weak",
    scoreCls: "text-destructive",
    scoreBg: "bg-destructive/10",
    topBorderCls: "bg-destructive",
  },
};

const PRIORITY_CLS: Record<"high" | "medium" | "low", string> = {
  high: "border-primary/30 bg-primary/10 text-primary",
  medium: "border-border bg-muted/30 text-muted-foreground",
  low: "border-border/40 bg-transparent text-muted-foreground/70",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface DecisionCardV2Props {
  title: string;
  summary: string;
  score: number;
  health: { status: HealthStatus; reason: string };
  priority: "high" | "medium" | "low";
  metrics: { impact: number; effort: number; confidence: number; demand: number };
  pushbacks?: Pushback[];
  topRisk?: string;
  onPushbackCta?: (action: PushbackAction) => void;
  onGenerateBrief: () => void;
  onConvert: () => void;
  onFocus?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  isBriefLoading?: boolean;
  isConverting?: boolean;
  footer?: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DecisionCardV2({
  onDelete,
  onEdit,
  title,
  summary,
  score,
  health,
  priority,
  metrics,
  pushbacks = [],
  topRisk,
  onPushbackCta,
  onGenerateBrief,
  onConvert,
  onFocus,
  isBriefLoading = false,
  isConverting = false,
  footer,
}: DecisionCardV2Props) {
  const hs = HEALTH_STYLES[health.status];
  const topPushback = pushbacks[0];
  const overcommitWarning = priority === "high" && metrics.confidence < 5;

  // Derive inline AI insight message
  let aiInsightMessage: string | null = null;
  let aiInsightSeverity: "info" | "warning" | "danger" = "info";
  if (overcommitWarning) {
    aiInsightMessage = "You're likely overcommitting — confidence is below threshold for a high-priority call.";
    aiInsightSeverity = "danger";
  } else if (topPushback) {
    aiInsightMessage = topPushback.message;
    aiInsightSeverity = topPushback.severity === "alert" ? "danger" : "warning";
  } else if (topRisk) {
    aiInsightMessage = topRisk;
    aiInsightSeverity = "warning";
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger focus if a button inside was clicked
    if ((e.target as HTMLElement).closest("button")) return;
    onFocus?.();
  };

  return (
    <article
      onClick={handleCardClick}
      className={`
        group relative flex flex-col rounded-2xl border border-border/60 bg-card
        shadow-sm transition-all duration-200 animate-fade-up overflow-hidden
        ${onFocus ? "cursor-pointer hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5" : ""}
      `}
    >
      {/* Semantic top strip (color = health status) */}
      <div className={`h-[3px] w-full shrink-0 ${hs.topBorderCls}`} />

      <div className="p-5 flex-1">
        {/* Header: score + health + priority */}
        <header className="flex items-start justify-between gap-3">
          {/* Score — large, prominent */}
          <div className={`flex items-center gap-2.5 rounded-xl px-3 py-1.5 ${hs.scoreBg}`}>
            <span
              className={`font-mono text-2xl font-bold tabular-nums leading-none ${hs.scoreCls}`}
            >
              {score}
            </span>
            <div className="flex flex-col">
              <span className={`text-[10px] font-semibold uppercase tracking-[0.06em] leading-none ${hs.scoreCls}`}>
                {hs.label}
              </span>
              <span className="text-[9px] text-muted-foreground/60 mt-0.5">/ 100</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] font-medium ${PRIORITY_CLS[priority]}`}>
              {priority}
            </span>
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                title="Edit decision"
                className="md:opacity-0 md:group-hover:opacity-100 h-8 w-8 sm:h-6 sm:w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                <Pencil className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                title="Delete decision"
                className="md:opacity-0 md:group-hover:opacity-100 h-8 w-8 sm:h-6 sm:w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
              </button>
            )}
          </div>
        </header>

        {/* Title */}
        <h3 className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-foreground">
          {title}
        </h3>

        {/* Summary */}
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {summary}
        </p>

        {/* Inline AI insight */}
        {aiInsightMessage && (
          <div className="mt-3">
            <AIInsight
              message={aiInsightMessage}
              severity={aiInsightSeverity}
              actions={
                topPushback && onPushbackCta
                  ? [
                      {
                        label: topPushback.cta.label,
                        onClick: () => onPushbackCta(topPushback.cta.action),
                      },
                    ]
                  : overcommitWarning
                  ? [{ label: "Add Evidence", onClick: () => onPushbackCta?.("add-evidence") }]
                  : []
              }
            />
          </div>
        )}

        {/* Focus hint — only shows on hover when onFocus is wired */}
        {onFocus && !aiInsightMessage && (
          <p className="mt-3 text-[11px] text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors duration-150 select-none">
            Click to deep-dive →
          </p>
        )}
      </div>

      {/* Metrics strip */}
      <div className="px-5 py-3 bg-muted/15 border-t border-border/60">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2">
          {(
            [
              ["Impact", metrics.impact],
              ["Effort", metrics.effort],
              ["Confidence", metrics.confidence],
              ["Demand", metrics.demand],
            ] as const
          ).map(([label, value]) => {
            const isLow = label === "Confidence" && value < 5;
            return (
              <div key={label} className="flex flex-col">
                <dt className="text-[9px] uppercase tracking-[0.06em] text-muted-foreground">
                  {label}
                </dt>
                <dd
                  className={`font-mono text-xs tabular-nums font-medium ${
                    isLow ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {value}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-4 pt-3 space-y-2 border-t border-border/60">
        <Button
          size="sm"
          className="w-full text-xs font-medium"
          onClick={onGenerateBrief}
          disabled={isBriefLoading}
        >
          {isBriefLoading ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-3 w-3" />
          )}
          Generate Case Brief
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="w-full text-xs text-muted-foreground hover:text-foreground"
          onClick={onConvert}
          disabled={isConverting}
        >
          {isConverting ? (
            "Generating PRD…"
          ) : (
            <>
              Convert to PRD
              <ArrowRight className="ml-1 h-3 w-3" />
            </>
          )}
        </Button>
      </div>

      {footer}
    </article>
  );
}
