"use client";

import React from "react";
import {
  X,
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  Target,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HealthStatus, Pushback, PushbackAction } from "@/lib/ai/decisionHealth";

// ─── Public data interface ────────────────────────────────────────────────────

export interface FocusPanelData {
  decisionId: string;
  title: string;
  summary: string;
  justification: string;
  userStory: string;
  tradeoffs: string;
  priority: "high" | "medium" | "low";
  score: number;
  impact: number;
  effort: number;
  confidence: number;
  demand: number;
  reasoning?: string;
  health: { status: HealthStatus; reason: string };
  pushbacks?: Pushback[];
  keyInsight?: string;
  recommendation?: string;
}

interface FocusPanelProps {
  data: FocusPanelData | null;
  onClose: () => void;
  onGenerateBrief: () => void;
  onConvert: () => void;
  onPushbackCta?: (action: PushbackAction) => void;
  isBriefLoading?: boolean;
  isConverting?: boolean;
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const HEALTH: Record<HealthStatus, { label: string; scoreCls: string; ringCls: string }> = {
  healthy: {
    label: "Strong",
    scoreCls: "text-success",
    ringCls: "ring-2 ring-success/30",
  },
  risky: {
    label: "Risky",
    scoreCls: "text-warning",
    ringCls: "ring-2 ring-warning/30",
  },
  weak: {
    label: "Weak",
    scoreCls: "text-destructive",
    ringCls: "ring-2 ring-destructive/30",
  },
};

const PRIORITY_CLS: Record<"high" | "medium" | "low", string> = {
  high: "border-primary/30 bg-primary/10 text-primary",
  medium: "border-border bg-muted/30 text-muted-foreground",
  low: "border-border/40 bg-transparent text-muted-foreground/70",
};

// ─── Metric tile ──────────────────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight
          ? "border-destructive/30 bg-destructive/5"
          : "border-border/50 bg-muted/20"
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 font-mono text-2xl font-bold tabular-nums leading-none ${
          highlight ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
        <span className="text-sm font-normal text-muted-foreground/50">/10</span>
      </p>
      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-border/40">
        <div
          className={`h-full rounded-full ${highlight ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FocusPanel({
  data,
  onClose,
  onGenerateBrief,
  onConvert,
  onPushbackCta,
  isBriefLoading = false,
  isConverting = false,
}: FocusPanelProps) {
  // Close on Escape
  React.useEffect(() => {
    if (!data) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [data, onClose]);

  if (!data) return null;

  const hs = HEALTH[data.health.status];

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px] transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Panel ── */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Decision: ${data.title}`}
        className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[480px] flex-col border-l border-border/60 bg-card shadow-2xl animate-brief-expand"
      >
        {/* Sticky header */}
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-border/60 bg-card/95 backdrop-blur-md px-6 py-4">
          <div className="flex items-center gap-4 min-w-0">
            {/* Score badge */}
            <div
              className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-muted/30 ${hs.ringCls}`}
            >
              <span
                className={`font-mono text-xl font-bold tabular-nums leading-none ${hs.scoreCls}`}
              >
                {data.score}
              </span>
              <span className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                {hs.label}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                Decision Focus
              </p>
              <h2 className="mt-0.5 text-[15px] font-semibold leading-snug tracking-tight text-foreground line-clamp-2">
                {data.title}
              </h2>
              <span
                className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] ${PRIORITY_CLS[data.priority]}`}
              >
                {data.priority}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close focus panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* AI health reason */}
          {data.health.reason && (
            <div className="flex items-start gap-2.5 rounded-r-md border-l-2 border-l-primary/50 bg-primary/[0.04] px-3 py-2.5">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-foreground/90">
                {data.health.reason}
              </p>
            </div>
          )}

          {/* User story */}
          <section>
            <h3 className="mb-2 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
              User Story
            </h3>
            <p className="text-sm leading-relaxed text-foreground/90">
              {data.userStory}
            </p>
          </section>

          {/* Justification */}
          <section>
            <h3 className="mb-2 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
              Justification
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {data.justification}
            </p>
          </section>

          {/* Trade-offs */}
          {data.tradeoffs && (
            <section>
              <h3 className="mb-2 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
                Trade-offs
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {data.tradeoffs}
              </p>
            </section>
          )}

          {/* Scoring breakdown */}
          <section>
            <h3 className="mb-3 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
              Scoring Breakdown
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <MetricTile label="Impact" value={data.impact} />
              <MetricTile label="Effort" value={data.effort} />
              <MetricTile
                label="Confidence"
                value={data.confidence}
                highlight={data.confidence < 5}
              />
              <MetricTile label="Demand" value={data.demand} />
            </div>
          </section>

          {/* Reasoning */}
          {data.reasoning && (
            <div className="flex items-start gap-2.5 rounded-lg bg-muted/30 p-3">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {data.reasoning}
              </p>
            </div>
          )}

          {/* Key insight + recommendation */}
          {(data.keyInsight || data.recommendation) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.keyInsight && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] font-semibold text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    Key Insight
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                    {data.keyInsight}
                  </p>
                </div>
              )}
              {data.recommendation && (
                <div className="rounded-lg border border-primary/25 bg-primary/[0.05] p-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] font-semibold text-primary">
                    <Target className="h-3 w-3" />
                    Suggested Action
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
                    {data.recommendation}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Pushbacks */}
          {data.pushbacks && data.pushbacks.length > 0 && (
            <section>
              <h3 className="mb-2 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
                Pushbacks
              </h3>
              <div className="space-y-2">
                {data.pushbacks.map((pb, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-md border-l-2 px-3 py-2 text-xs ${
                      pb.severity === "alert"
                        ? "border-l-destructive bg-destructive/5 text-foreground"
                        : "border-l-warning bg-warning/5 text-foreground"
                    }`}
                  >
                    {pb.severity === "alert" ? (
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium leading-relaxed">{pb.message}</p>
                      {onPushbackCta && (
                        <button
                          type="button"
                          onClick={() => {
                            onPushbackCta(pb.cta.action);
                            onClose();
                          }}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium hover:underline underline-offset-2"
                        >
                          {pb.cta.label}
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sticky footer actions */}
        <div className="shrink-0 border-t border-border/60 bg-card/95 backdrop-blur-md px-6 py-4 space-y-2">
          <Button
            className="w-full"
            onClick={onGenerateBrief}
            disabled={isBriefLoading}
          >
            {isBriefLoading ? (
              "Drafting brief…"
            ) : (
              <>
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                Generate Case Brief
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={onConvert}
            disabled={isConverting}
          >
            {isConverting ? "Generating PRD…" : "Convert to PRD"}
            {!isConverting && <ArrowRight className="ml-2 h-3.5 w-3.5" />}
          </Button>
        </div>
      </aside>
    </>
  );
}
