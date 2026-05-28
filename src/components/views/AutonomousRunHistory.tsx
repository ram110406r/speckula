"use client";

import React from "react";
import {
  Loader2, CheckCircle2, Clock, Zap, Brain, Cpu, Activity,
  ShieldCheck, ShieldAlert, ShieldX, ChevronRight, PlayCircle,
  ListChecks, AlertTriangle, History,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import {
  useAgentRuns, useAgentRunStats, useAgentRun,
  type AgentRunSummary, type AgentVerdict, type AgentRunDetail,
} from "@/hooks/useAgents";

// ── helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatTokens(n: number | undefined): string {
  if (!n) return "0";
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function shortLabel(s: string | null): string {
  if (!s) return "—";
  return s.replace(/_/g, " ");
}

const VERDICT_META: Record<AgentVerdict, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  PROCEED:        { label: "Proceed",        color: "text-success",     bg: "bg-success/10 border-success/30",         icon: ShieldCheck },
  VALIDATE_FIRST: { label: "Validate first", color: "text-warning",     bg: "bg-warning/10 border-warning/30",         icon: ShieldAlert },
  DO_NOT_BUILD:   { label: "Don't build",    color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", icon: ShieldX },
};

const DEPTH_ICON: Record<string, React.ElementType> = { quick: Zap, standard: Brain, deep: Cpu };

function MetricCard({ label, value, tone = "text-foreground", icon: Icon }: {
  label: string; value: React.ReactNode; tone?: string; icon?: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground/60">
        {Icon && <Icon className="h-3 w-3" />}
        <span className="font-mono text-[9px] uppercase tracking-[0.08em]">{label}</span>
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

// ── run row (expandable) ──────────────────────────────────────────────────────

function RunDetailBody({ run }: { run: AgentRunDetail }) {
  const decisions = Array.isArray(run.decisions) ? run.decisions : [];
  const roadmap = Array.isArray(run.roadmap) ? run.roadmap : [];
  const strategyTheme =
    run.strategy && typeof run.strategy === "object" && "theme" in run.strategy
      ? String((run.strategy as { theme?: unknown }).theme ?? "")
      : "";
  const steps = Array.isArray(run.steps) ? run.steps : [];

  const titleOf = (d: unknown): string =>
    d && typeof d === "object" && "title" in d ? String((d as { title?: unknown }).title ?? "Untitled") : "Untitled";

  return (
    <div className="space-y-3 border-t border-border/60 bg-muted/20 px-4 py-3">
      {run.verdictReason && (
        <p className="text-xs leading-relaxed text-foreground/70">{run.verdictReason}</p>
      )}
      {strategyTheme && (
        <div>
          <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground/50">Strategy</p>
          <p className="text-xs text-foreground/80">{strategyTheme}</p>
        </div>
      )}
      {decisions.length > 0 && (
        <div>
          <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground/50">
            Decisions ({decisions.length})
          </p>
          <ul className="mt-1 space-y-0.5">
            {decisions.slice(0, 3).map((d, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/75">
                <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/40" />
                {titleOf(d)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {roadmap.length > 0 && (
        <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground/50">
          Roadmap · {roadmap.length} phase{roadmap.length === 1 ? "" : "s"}
        </p>
      )}
      {steps.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {steps.map((s, i) => (
            <span key={i} className="rounded border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/60">
              {shortLabel(s.step)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RunRow({ run, expanded, onToggle }: {
  run: AgentRunSummary; expanded: boolean; onToggle: () => void;
}) {
  const { run: detail, loading } = useAgentRun(expanded ? run.id : null);
  const verdict = run.verdict ? VERDICT_META[run.verdict] : null;
  const DepthIcon = DEPTH_ICON[run.depth] ?? Brain;
  const running = run.status === "running";

  return (
    <div className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-transform ${expanded ? "rotate-90" : ""}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground/90">{run.idea}</p>
          <p className="mt-0.5 flex items-center gap-2 font-mono text-[9px] text-muted-foreground/50">
            <span className="inline-flex items-center gap-1"><DepthIcon className="h-2.5 w-2.5" />{run.depth}</span>
            <span>·</span>
            <span>{relativeTime(run.startedAt)}</span>
            {run.durationMs != null && <><span>·</span><span>{formatDuration(run.durationMs)}</span></>}
            {run.tokensUsed > 0 && <><span>·</span><span>{formatTokens(run.tokensUsed)} tok</span></>}
          </p>
        </div>
        {running ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[9px] text-primary">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> {shortLabel(run.currentStep)}
          </span>
        ) : verdict ? (
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] ${verdict.bg} ${verdict.color}`}>
            <verdict.icon className="h-2.5 w-2.5" /> {verdict.label}
          </span>
        ) : (
          <span className="shrink-0 font-mono text-[9px] uppercase text-muted-foreground/50">{run.status}</span>
        )}
      </button>

      {expanded && (
        loading
          ? <div className="flex items-center gap-2 border-t border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground/60"><Loader2 className="h-3 w-3 animate-spin" /> Loading run…</div>
          : detail
            ? <RunDetailBody run={detail} />
            : <p className="border-t border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground/50">Could not load run detail.</p>
      )}
    </div>
  );
}

// ── main: collapsible run-history section ──────────────────────────────────────

const RUN_FILTERS: { id: string | undefined; label: string }[] = [
  { id: undefined, label: "All" }, { id: "completed", label: "Completed" },
  { id: "running", label: "Running" }, { id: "stopped", label: "Stopped" },
];

export function AutonomousRunHistory() {
  const setActiveView = useAppStore((s) => s.setActiveView);
  const { data: runStats } = useAgentRunStats();
  const [runFilter, setRunFilter] = React.useState<string | undefined>(undefined);
  const { data: runsData, loading: runsLoading } = useAgentRuns(runFilter);
  const [expandedRunId, setExpandedRunId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  const runs = runsData?.runs ?? [];
  const total = runStats?.total ?? 0;

  return (
    <section className="space-y-3 pt-4 border-t border-border/40">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <History className="h-4 w-4 text-muted-foreground/60" />
          Autonomous run history
          <span className="font-mono text-[11px] font-normal text-muted-foreground/60">({total})</span>
          <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
        <button
          type="button"
          onClick={() => setActiveView("autonomous")}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-[10px] font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <PlayCircle className="h-3 w-3" /> New run
        </button>
      </div>

      {open && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MetricCard label="Total runs" value={runStats?.total ?? 0} icon={ListChecks} />
            <MetricCard label="Proceed"     value={runStats?.verdicts?.PROCEED ?? 0} tone="text-success" icon={ShieldCheck} />
            <MetricCard label="Validate"    value={runStats?.verdicts?.VALIDATE_FIRST ?? 0} tone="text-warning" icon={ShieldAlert} />
            <MetricCard label="Avg time"    value={formatDuration(runStats?.avgDurationMs ?? null)} icon={Clock} />
            <MetricCard label="Tokens 30d"  value={formatTokens(runStats?.totalTokensLast30d)} icon={Activity} />
          </div>

          <div className="flex gap-1">
            {RUN_FILTERS.map((f) => (
              <button key={f.label} type="button" onClick={() => setRunFilter(f.id)}
                className={`rounded px-2 py-0.5 font-mono text-[9px] transition-colors ${
                  runFilter === f.id ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground"
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card">
            {runsLoading && runs.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-8 text-xs text-muted-foreground/50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading runs…
              </div>
            ) : runs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <AlertTriangle className="h-5 w-5 text-muted-foreground/30" />
                <p className="text-sm text-foreground/70">No autonomous runs yet</p>
                <p className="max-w-xs text-xs text-muted-foreground/50">
                  Run the agent on a product idea to generate decisions, a strategy, and a verdict.
                </p>
                <button type="button" onClick={() => setActiveView("autonomous")}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-[10px] font-medium text-primary-foreground hover:opacity-90 transition-opacity">
                  <PlayCircle className="h-3 w-3" /> Launch a run
                </button>
              </div>
            ) : (
              <div className="max-h-[360px] divide-y divide-border/50 overflow-y-auto custom-scrollbar">
                {runs.map((r) => (
                  <RunRow key={r.id} run={r} expanded={expandedRunId === r.id}
                    onToggle={() => setExpandedRunId((cur) => (cur === r.id ? null : r.id))} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
