"use client";

import React from "react";
import {
  Bot, Radar, Eye, Sparkles, Cpu, Activity, Loader2,
  CheckCircle2, XCircle, Clock, Zap, Brain, ShieldCheck,
  ShieldAlert, ShieldX, ChevronRight, PlayCircle, RefreshCw,
  Inbox, ListChecks, AlertTriangle, Pencil, Trash2, Plus,
  X, Save, Calendar, Coins, GitBranch,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { toast } from "@/store/useToastStore";
import {
  useAgents, useAgentJobs, useAgentHistory,
  useAgentRuns, useAgentRunStats, useAgentRun,
  type AgentStatus, type AgentJob, type AgentRunSummary,
  type AgentVerdict, type AgentRunDetail,
  type AutonomyLevel, type MemoryScope,
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

function shortModel(m: string): string {
  // "llama-3.3-70b-versatile" → "llama-3.3-70b"
  return m.replace(/-versatile$|-instant$/, "").replace(/^.*\//, "");
}

const AGENT_ICON: Record<string, React.ElementType> = {
  market_scanner: Radar,
  competitor_watcher: Eye,
  insight_synthesizer: Sparkles,
  analysis_engine: Cpu,
};

const AUTONOMY_META: Record<AutonomyLevel, { label: string; color: string }> = {
  manual:  { label: "Manual",  color: "text-muted-foreground" },
  suggest: { label: "Suggest", color: "text-primary" },
  auto:    { label: "Auto",    color: "text-success" },
};

const MODEL_OPTIONS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
const AUTONOMY_OPTIONS: AutonomyLevel[] = ["manual", "suggest", "auto"];
const MEMORY_OPTIONS: MemoryScope[] = ["none", "agent", "workspace", "global"];

const JOB_RUNNING = new Set([
  "extracting", "classifying", "generating_insights", "embedding", "saving",
]);

function jobStatusTone(status: string): { color: string; icon: React.ElementType } {
  if (status === "completed") return { color: "text-success", icon: CheckCircle2 };
  if (status === "failed")    return { color: "text-destructive", icon: XCircle };
  if (status === "queued")    return { color: "text-warning", icon: Clock };
  if (JOB_RUNNING.has(status)) return { color: "text-primary", icon: Loader2 };
  return { color: "text-muted-foreground", icon: Activity };
}

const VERDICT_META: Record<AgentVerdict, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  PROCEED:        { label: "Proceed",        color: "text-success",     bg: "bg-success/10 border-success/30",         icon: ShieldCheck },
  VALIDATE_FIRST: { label: "Validate first", color: "text-warning",     bg: "bg-warning/10 border-warning/30",         icon: ShieldAlert },
  DO_NOT_BUILD:   { label: "Don't build",    color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", icon: ShieldX },
};

const DEPTH_ICON: Record<string, React.ElementType> = { quick: Zap, standard: Brain, deep: Cpu };

// ── section primitives ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">
      {children}
    </h2>
  );
}

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

function Chip({ icon: Icon, children, tone = "text-muted-foreground/70" }: {
  icon?: React.ElementType; children: React.ReactNode; tone?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 font-mono text-[9px] ${tone}`}>
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {children}
    </span>
  );
}

// ── agent card ─────────────────────────────────────────────────────────────

function AgentCard({ agent, busy, onToggle, onEdit, onDelete }: {
  agent: AgentStatus;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = AGENT_ICON[agent.key] ?? Bot;
  const running = agent.status === "running";
  const disabled = !agent.enabled;
  const autonomy = AUTONOMY_META[agent.autonomyLevel];

  return (
    <div className={`rounded-xl border bg-card p-4 transition-colors ${disabled ? "border-border/50 opacity-70" : "border-border hover:border-border/80"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${running ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{agent.name}</p>
            <p className="truncate text-[11px] text-muted-foreground/60">{agent.objective ?? agent.role}</p>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-wide ${
          disabled ? "text-muted-foreground/40" : running ? "text-primary" : "text-muted-foreground/50"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${disabled ? "bg-muted-foreground/30" : running ? "bg-primary animate-pulse" : "bg-muted-foreground/40"}`} />
          {disabled ? "Disabled" : running ? "Running" : "Idle"}
        </span>
      </div>

      {/* Config chips */}
      <div className="mt-3 flex flex-wrap gap-1">
        <Chip icon={Cpu}>{shortModel(agent.modelName)}</Chip>
        <Chip tone={autonomy.color}>{autonomy.label}</Chip>
        {agent.schedule && <Chip icon={Calendar}>{agent.schedule}</Chip>}
        {agent.tokenBudget != null && <Chip icon={Coins}>{formatTokens(agent.tokenBudget)}</Chip>}
        <Chip icon={GitBranch}>{agent.memoryScope}</Chip>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        {[
          { k: "Running", v: agent.runningJobs, tone: "text-primary" },
          { k: "Queued",  v: agent.queuedJobs,  tone: "text-warning" },
          { k: "Done",    v: agent.completedTotal, tone: "text-success" },
          { k: "Failed",  v: agent.failedTotal, tone: agent.failedTotal > 0 ? "text-destructive" : "text-muted-foreground/50" },
        ].map(({ k, v, tone }) => (
          <div key={k}>
            <p className={`text-base font-semibold tabular-nums ${tone}`}>{v}</p>
            <p className="font-mono text-[8px] uppercase tracking-wide text-muted-foreground/50">{k}</p>
          </div>
        ))}
      </div>

      {/* Footer: activity + actions */}
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2">
        <span className="font-mono text-[9px] text-muted-foreground/50">
          Last activity {relativeTime(agent.lastActivity)}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            title={agent.enabled ? "Disable agent" : "Enable agent"}
            className={`relative h-3.5 w-7 rounded-full transition-colors disabled:opacity-50 ${agent.enabled ? "bg-primary/80" : "bg-muted"}`}
          >
            <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-card transition-all ${agent.enabled ? "left-3.5" : "left-0.5"}`} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            title="Edit config"
            className="rounded p-1 text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
          >
            <Pencil className="h-3 w-3" />
          </button>
          {!agent.isDefault && (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              title="Delete agent"
              className="rounded p-1 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── agent config modal (create + edit) ──────────────────────────────────────

interface AgentForm {
  name: string;
  role: string;
  objective: string;
  modelName: string;
  autonomyLevel: AutonomyLevel;
  temperature: number;
  schedule: string;
  tokenBudget: string;   // text input → parsed
  maxRetries: number;
  memoryScope: MemoryScope;
}

function emptyForm(): AgentForm {
  return {
    name: "", role: "", objective: "", modelName: MODEL_OPTIONS[0],
    autonomyLevel: "suggest", temperature: 0.7, schedule: "",
    tokenBudget: "", maxRetries: 1, memoryScope: "workspace",
  };
}

function agentToForm(a: AgentStatus): AgentForm {
  return {
    name: a.name, role: a.role, objective: a.objective ?? "",
    modelName: a.modelName, autonomyLevel: a.autonomyLevel, temperature: a.temperature,
    schedule: a.schedule ?? "", tokenBudget: a.tokenBudget != null ? String(a.tokenBudget) : "",
    maxRetries: a.maxRetries, memoryScope: a.memoryScope,
  };
}

function AgentConfigModal({ mode, initial, busy, onClose, onSubmit }: {
  mode: "create" | "edit";
  initial: AgentForm;
  busy: boolean;
  onClose: () => void;
  onSubmit: (form: AgentForm) => void;
}) {
  const [form, setForm] = React.useState<AgentForm>(initial);
  const set = <K extends keyof AgentForm>(k: K, v: AgentForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit = form.name.trim().length > 0 && form.role.trim().length > 0 && !busy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-foreground">
            {mode === "create" ? "New agent" : "Edit agent"}
          </h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Growth Analyst"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25" />
            </Field>
            <Field label="Role">
              <input value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="Analyzes acquisition funnels"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25" />
            </Field>
          </div>

          <Field label="Objective">
            <textarea value={form.objective} onChange={(e) => set("objective", e.target.value)} rows={2}
              placeholder="What this agent is responsible for…"
              className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Model">
              <select value={form.modelName} onChange={(e) => set("modelName", e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25">
                {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Memory scope">
              <select value={form.memoryScope} onChange={(e) => set("memoryScope", e.target.value as MemoryScope)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25">
                {MEMORY_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Autonomy">
            <div className="flex rounded-md border border-border overflow-hidden">
              {AUTONOMY_OPTIONS.map((lvl) => (
                <button key={lvl} type="button" onClick={() => set("autonomyLevel", lvl)}
                  className={`flex-1 py-1.5 font-mono text-[10px] capitalize transition-colors border-r last:border-r-0 border-border ${
                    form.autonomyLevel === lvl ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:text-foreground"
                  }`}>
                  {lvl}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label={`Temp ${form.temperature.toFixed(1)}`}>
              <input type="range" min={0} max={2} step={0.1} value={form.temperature}
                onChange={(e) => set("temperature", parseFloat(e.target.value))} className="w-full accent-primary" />
            </Field>
            <Field label="Token budget">
              <input value={form.tokenBudget} onChange={(e) => set("tokenBudget", e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="∞" inputMode="numeric"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25" />
            </Field>
            <Field label="Max retries">
              <input type="number" min={0} max={5} value={form.maxRetries}
                onChange={(e) => set("maxRetries", Math.max(0, Math.min(5, parseInt(e.target.value || "0", 10))))}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25" />
            </Field>
          </div>

          <Field label="Schedule (cron — leave blank for on-demand)">
            <input value={form.schedule} onChange={(e) => set("schedule", e.target.value)} placeholder="0 9 * * 1"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/25" />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="button" disabled={!canSubmit} onClick={() => onSubmit(form)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-[11px] font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/60">{label}</span>
      {children}
    </label>
  );
}

// ── throughput chart ────────────────────────────────────────────────────────

function ThroughputChart({ trend }: { trend: { date: string; queued: number; completed: number; failed: number }[] }) {
  if (!trend.length) {
    return <p className="py-8 text-center text-xs text-muted-foreground/50">No activity in the last 14 days.</p>;
  }
  const max = Math.max(1, ...trend.map((d) => d.queued));
  return (
    <div>
      <div className="flex h-28 items-end gap-1">
        {trend.map((d) => {
          const total = d.queued;
          const other = Math.max(0, total - d.completed - d.failed);
          const h = (total / max) * 100;
          return (
            <div
              key={d.date}
              className="group relative flex flex-1 flex-col justify-end"
              title={`${d.date}: ${total} job${total === 1 ? "" : "s"} · ${d.completed} done · ${d.failed} failed`}
            >
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-sm" style={{ height: `${h}%`, minHeight: total > 0 ? 3 : 0 }}>
                <div className="w-full bg-success/70" style={{ flexGrow: d.completed }} />
                <div className="w-full bg-destructive/70" style={{ flexGrow: d.failed }} />
                <div className="w-full bg-muted-foreground/30" style={{ flexGrow: other }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-4 font-mono text-[9px] text-muted-foreground/50">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-success/70" /> Completed</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-destructive/70" /> Failed</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-muted-foreground/30" /> Other</span>
        <span className="ml-auto">Last 14 days</span>
      </div>
    </div>
  );
}

// ── job feed ───────────────────────────────────────────────────────────────

function JobRow({ job }: { job: AgentJob }) {
  const tone = jobStatusTone(job.status);
  const Icon = tone.icon;
  const spinning = JOB_RUNNING.has(job.status);
  const label = job.sourceUrl
    ? job.sourceUrl.replace(/^https?:\/\//, "").slice(0, 48)
    : (job.pageType ?? "analysis");
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${tone.color} ${spinning ? "animate-spin" : ""}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-foreground/90">{label}</p>
        <p className="font-mono text-[9px] text-muted-foreground/50">
          {shortLabel(job.status)} · {relativeTime(job.createdAt)}
          {job.error ? ` · ${job.error.slice(0, 40)}` : ""}
        </p>
      </div>
      {spinning && (
        <div className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(5, job.progress))}%` }} />
        </div>
      )}
    </div>
  );
}

// ── autonomous run row (expandable) ──────────────────────────────────────────

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

// ── main view ────────────────────────────────────────────────────────────────

export function AgentsView() {
  const setActiveView = useAppStore((s) => s.setActiveView);
  const { user } = useAuth();

  const { data: fleet, loading: fleetLoading, error: fleetError, refetch: refetchFleet } = useAgents();
  const { data: history } = useAgentHistory();
  const [jobFilter, setJobFilter] = React.useState<string | undefined>(undefined);
  const { data: jobsData } = useAgentJobs(jobFilter);
  const { data: runStats } = useAgentRunStats();
  const [runFilter, setRunFilter] = React.useState<string | undefined>(undefined);
  const { data: runsData, loading: runsLoading } = useAgentRuns(runFilter);
  const [expandedRunId, setExpandedRunId] = React.useState<string | null>(null);

  // Config modal + mutation state
  const [modal, setModal] = React.useState<{ mode: "create" | "edit"; agent: AgentStatus | null } | null>(null);
  const [modalBusy, setModalBusy] = React.useState(false);
  const [busyAgentId, setBusyAgentId] = React.useState<string | null>(null);

  const summary = fleet?.summary;
  const agents = fleet?.agents ?? [];
  const jobs = jobsData?.jobs ?? [];
  const runs = runsData?.runs ?? [];

  const authedFetch = React.useCallback(async (url: string, init: RequestInit) => {
    if (!user) throw new Error("Not signed in");
    const token = await user.getIdToken();
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || body.ok === false) throw new Error(body.error ?? `Request failed: ${res.status}`);
    return body;
  }, [user]);

  const toggleAgent = React.useCallback(async (agent: AgentStatus) => {
    setBusyAgentId(agent.id);
    try {
      await authedFetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !agent.enabled }),
      });
      refetchFleet();
    } catch (e) {
      toast.error("Failed to update agent", e instanceof Error ? e.message : undefined);
    } finally {
      setBusyAgentId(null);
    }
  }, [authedFetch, refetchFleet]);

  const deleteAgent = React.useCallback(async (agent: AgentStatus) => {
    if (!window.confirm(`Delete "${agent.name}"? This cannot be undone.`)) return;
    setBusyAgentId(agent.id);
    try {
      await authedFetch(`/api/agents/${agent.id}`, { method: "DELETE" });
      toast.success("Agent deleted", agent.name);
      refetchFleet();
    } catch (e) {
      toast.error("Failed to delete agent", e instanceof Error ? e.message : undefined);
    } finally {
      setBusyAgentId(null);
    }
  }, [authedFetch, refetchFleet]);

  const submitModal = React.useCallback(async (form: AgentForm) => {
    setModalBusy(true);
    const payload = {
      name: form.name.trim(),
      role: form.role.trim(),
      objective: form.objective.trim() || null,
      modelName: form.modelName,
      autonomyLevel: form.autonomyLevel,
      temperature: form.temperature,
      schedule: form.schedule.trim() || null,
      tokenBudget: form.tokenBudget ? parseInt(form.tokenBudget, 10) : null,
      maxRetries: form.maxRetries,
      memoryScope: form.memoryScope,
    };
    try {
      if (modal?.mode === "edit" && modal.agent) {
        await authedFetch(`/api/agents/${modal.agent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Agent updated", payload.name);
      } else {
        await authedFetch(`/api/agents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Agent created", payload.name);
      }
      setModal(null);
      refetchFleet();
    } catch (e) {
      toast.error("Failed to save agent", e instanceof Error ? e.message : undefined);
    } finally {
      setModalBusy(false);
    }
  }, [authedFetch, modal, refetchFleet]);

  const JOB_FILTERS: { id: string | undefined; label: string }[] = [
    { id: undefined, label: "All" }, { id: "completed", label: "Completed" },
    { id: "failed", label: "Failed" }, { id: "queued", label: "Queued" },
  ];
  const RUN_FILTERS: { id: string | undefined; label: string }[] = [
    { id: undefined, label: "All" }, { id: "completed", label: "Completed" },
    { id: "running", label: "Running" }, { id: "stopped", label: "Stopped" },
  ];

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-background">
      <div className="mx-auto max-w-6xl px-6 py-6 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">Agents</h1>
              <p className="text-xs text-muted-foreground/70">
                Configurable agent fleet &amp; autonomous reasoning runs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => refetchFleet()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
            <button type="button" onClick={() => setActiveView("autonomous")}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-[10px] font-medium text-primary-foreground hover:opacity-90 transition-opacity">
              <PlayCircle className="h-3 w-3" /> Launch run
            </button>
          </div>
        </div>

        {/* Fleet summary strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Running"   value={summary?.running ?? 0}   tone="text-primary"  icon={Loader2} />
          <MetricCard label="Queued"    value={summary?.queued ?? 0}    tone="text-warning"  icon={Clock} />
          <MetricCard label="Completed" value={summary?.completed ?? 0} tone="text-success"  icon={CheckCircle2} />
          <MetricCard label="Failed"    value={summary?.failed ?? 0}    tone={(summary?.failed ?? 0) > 0 ? "text-destructive" : "text-muted-foreground/60"} icon={XCircle} />
        </div>

        {/* Fleet cards */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Agent fleet {summary ? `· ${summary.enabled}/${summary.total} enabled` : ""}</SectionLabel>
            <button type="button" onClick={() => setModal({ mode: "create", agent: null })}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-3 w-3" /> New agent
            </button>
          </div>
          {fleetError && agents.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-xs text-destructive">Couldn&apos;t load the agent fleet: {fleetError}</p>
              <button type="button" onClick={() => refetchFleet()}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          ) : fleetLoading && agents.length === 0 ? (
            <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading fleet…
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {agents.map((a) => (
                <AgentCard
                  key={a.id}
                  agent={a}
                  busy={busyAgentId === a.id}
                  onToggle={() => toggleAgent(a)}
                  onEdit={() => setModal({ mode: "edit", agent: a })}
                  onDelete={() => deleteAgent(a)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Throughput + Job feed */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="space-y-3">
            <SectionLabel>Throughput</SectionLabel>
            <div className="rounded-xl border border-border bg-card p-4">
              <ThroughputChart trend={history?.dailyTrend ?? []} />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionLabel>Job feed</SectionLabel>
              <div className="flex gap-1">
                {JOB_FILTERS.map((f) => (
                  <button key={f.label} type="button" onClick={() => setJobFilter(f.id)}
                    className={`rounded px-2 py-0.5 font-mono text-[9px] transition-colors ${
                      jobFilter === f.id ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground"
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card">
              {jobs.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-10 text-center">
                  <Inbox className="h-5 w-5 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground/50">No jobs to show.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50 max-h-[280px] overflow-y-auto custom-scrollbar">
                  {jobs.map((j) => <JobRow key={j.id} job={j} />)}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Autonomous runs */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Autonomous runs</SectionLabel>
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
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MetricCard label="Total runs" value={runStats?.total ?? 0} icon={ListChecks} />
            <MetricCard label="Proceed"     value={runStats?.verdicts?.PROCEED ?? 0} tone="text-success" icon={ShieldCheck} />
            <MetricCard label="Validate"    value={runStats?.verdicts?.VALIDATE_FIRST ?? 0} tone="text-warning" icon={ShieldAlert} />
            <MetricCard label="Avg time"    value={formatDuration(runStats?.avgDurationMs ?? null)} icon={Clock} />
            <MetricCard label="Tokens 30d"  value={formatTokens(runStats?.totalTokensLast30d)} icon={Activity} />
          </div>

          <div className="rounded-xl border border-border bg-card">
            {runsLoading && runs.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-10 text-xs text-muted-foreground/50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading runs…
              </div>
            ) : runs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <AlertTriangle className="h-5 w-5 text-muted-foreground/30" />
                <p className="text-sm text-foreground/70">No autonomous runs yet</p>
                <p className="max-w-xs text-xs text-muted-foreground/50">
                  Launch the agent on a product idea to generate decisions, a strategy, and a verdict.
                </p>
                <button type="button" onClick={() => setActiveView("autonomous")}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-[10px] font-medium text-primary-foreground hover:opacity-90 transition-opacity">
                  <PlayCircle className="h-3 w-3" /> Launch a run
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {runs.map((r) => (
                  <RunRow key={r.id} run={r} expanded={expandedRunId === r.id}
                    onToggle={() => setExpandedRunId((cur) => (cur === r.id ? null : r.id))} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {modal && (
        <AgentConfigModal
          mode={modal.mode}
          initial={modal.mode === "edit" && modal.agent ? agentToForm(modal.agent) : emptyForm()}
          busy={modalBusy}
          onClose={() => !modalBusy && setModal(null)}
          onSubmit={submitModal}
        />
      )}
    </div>
  );
}
