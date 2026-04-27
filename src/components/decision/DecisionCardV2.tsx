import React from "react";
import { Sparkles, Loader2, ArrowRight, AlertTriangle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HealthStatus, Pushback, PushbackAction } from "@/lib/ai/decisionHealth";

const healthStyles: Record<HealthStatus, { pillCls: string; dotCls: string; emoji: string; label: string }> = {
  healthy: {
    pillCls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dotCls: "bg-emerald-500",
    emoji: "🟢",
    label: "Strong",
  },
  risky: {
    pillCls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dotCls: "bg-amber-500",
    emoji: "🟡",
    label: "Risky",
  },
  weak: {
    pillCls: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
    dotCls: "bg-red-500",
    emoji: "🔴",
    label: "Weak",
  },
};

const priorityBadgeStyles: Record<"high" | "medium" | "low", string> = {
  high: "border-primary/30 bg-primary/10 text-primary",
  medium: "border-border bg-muted/30 text-muted-foreground",
  low: "border-border/40 bg-transparent text-muted-foreground/70",
};

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
  isBriefLoading?: boolean;
  isConverting?: boolean;
  footer?: React.ReactNode;
}

export function DecisionCardV2({
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
  isBriefLoading = false,
  isConverting = false,
  footer,
}: DecisionCardV2Props) {
  const hs = healthStyles[health.status];
  const topPushback = pushbacks[0];
  const overcommitWarning = priority === "high" && metrics.confidence < 5;

  return (
    <article className="flex flex-col rounded-2xl border border-border/60 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md animate-fade-up">
      <div className="p-5 flex-1">
        <header className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${hs.pillCls}`}>
            <span aria-hidden>{hs.emoji}</span>
            <span>{hs.label}</span>
            <span className="font-mono tabular-nums opacity-80">({score})</span>
          </span>
          <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] font-medium ${priorityBadgeStyles[priority]}`}>
            {priority}
          </span>
        </header>

        <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-snug tracking-tight text-foreground">
          {title}
        </h3>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {summary}
        </p>

        {overcommitWarning && (
          <div className="mt-3 flex items-start gap-2 rounded-md border-l-2 border-l-red-500 bg-red-500/[0.04] px-2.5 py-1.5 text-xs">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-600" />
            <p className="leading-relaxed font-medium text-red-800 dark:text-red-200">
              You&apos;re likely overcommitting — validate first.
            </p>
          </div>
        )}

        {topRisk && !topPushback && (
          <div className="mt-3 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
            <p className="line-clamp-2 leading-relaxed">{topRisk}</p>
          </div>
        )}

        {topPushback && (
          <div
            className={`mt-3 flex items-start gap-2 rounded-md border-l-2 px-3 py-2 text-xs ${
              topPushback.severity === "alert"
                ? "border-l-red-500 bg-red-500/[0.04] text-red-800 dark:text-red-200"
                : "border-l-amber-500 bg-amber-500/[0.04] text-amber-900 dark:text-amber-200"
            }`}
          >
            {topPushback.severity === "alert" ? (
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <div className="flex-1 leading-relaxed">
              <p className="font-medium">{topPushback.message}</p>
              {onPushbackCta && (
                <button
                  type="button"
                  onClick={() => onPushbackCta(topPushback.cta.action)}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium hover:underline underline-offset-2"
                >
                  {topPushback.cta.label}
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-3 bg-muted/15 border-t border-border/60">
        <dl className="grid grid-cols-4 gap-x-3">
          {([
            ["Impact", metrics.impact],
            ["Effort", metrics.effort],
            ["Confidence", metrics.confidence],
            ["Demand", metrics.demand],
          ] as const).map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-[9px] uppercase tracking-[0.06em] text-muted-foreground">{label}</dt>
              <dd className="font-mono text-xs tabular-nums text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

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
          {isConverting ? "Generating PRD…" : (
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
