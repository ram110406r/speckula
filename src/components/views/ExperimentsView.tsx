"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  FlaskConical, Brain, CheckCircle2, Clock, Pause, Play,
  ChevronRight, TrendingUp, TrendingDown, ArrowUpRight,
  Users, BarChart2, Lightbulb, AlertTriangle, BookOpen,
  Sparkles, Target, Zap, Loader2, Plus, X, StopCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/useApi";
import { useExtensionPreferences } from "@/hooks/useExtensionPreferences";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useSpecklaBus } from "@/hooks/useSpecklaBus";

// ─── types ────────────────────────────────────────────────────────────────────

// "planned" is the Prisma default for newly created experiments.
type ExperimentStatus = "planned" | "running" | "completed" | "paused" | "abandoned";

interface ApiVariantStat {
  id: string;
  name: string;
  isControl: boolean;
  impressions: number;
  conversions: number;
  conversionRate: number;
  lift: number | null;
  pValue: number | null;
  significant: boolean;
}

interface ApiExperiment {
  id: string;
  title: string;
  hypothesis: string;
  targetMetric: string;
  status: ExperimentStatus;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  aiInsight: string | null;
  tags: string[] | null;
  variants: ApiVariantStat[];
  stats: ApiVariantStat[];
  verdict: string;
}

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
  startedAt: string | null;
  aiInsight: string;
}

// ─── transform ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function mapExperiment(api: ApiExperiment): Experiment {
  const stats = api.stats ?? api.variants ?? [];
  const control    = stats.find((s) => s.isControl)  ?? stats[0];
  const challenger = stats.find((s) => !s.isControl) ?? stats[1];

  const baseline       = control    ? Math.round(control.conversionRate    * 10000) / 100 : 0;
  const variant_result = challenger ? Math.round(challenger.conversionRate * 10000) / 100 : null;

  let improvement: string | null = null;
  if (challenger?.lift != null) {
    const l = Math.round(challenger.lift);
    improvement = (l >= 0 ? "+" : "") + l + "%";
  }

  let confidence: number | null = null;
  if (challenger?.pValue != null) {
    confidence = Math.min(100, Math.round((1 - challenger.pValue) * 100));
  }

  const n = stats.reduce((sum, s) => sum + s.impressions, 0);

  return {
    id:             api.id,
    name:           api.title,
    hypothesis:     api.hypothesis,
    status:         api.status,
    variant_a:      control?.name    ?? "Control",
    variant_b:      challenger?.name ?? "Challenger",
    metric:         api.targetMetric,
    baseline,
    variant_result,
    improvement,
    confidence,
    n,
    startedAt:      api.startedAt,
    aiInsight:      api.aiInsight ?? "No AI insight yet — complete the experiment to generate one.",
  };
}

// ─── config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ExperimentStatus, { label: string; color: string; bg: string; dotClass: string; pulse: boolean }> = {
  planned:   { label: "Planned",   color: "text-purple-400",       bg: "bg-purple-500/10 border-purple-500/20",  dotClass: "bg-purple-500",          pulse: false },
  running:   { label: "Running",   color: "text-emerald-500",      bg: "bg-emerald-500/10 border-emerald-500/20", dotClass: "bg-emerald-500",       pulse: true  },
  completed: { label: "Completed", color: "text-blue-400",         bg: "bg-blue-500/10 border-blue-500/20",       dotClass: "bg-blue-500",           pulse: false },
  paused:    { label: "Paused",    color: "text-amber-400",        bg: "bg-amber-500/10 border-amber-500/20",     dotClass: "bg-amber-500",          pulse: false },
  abandoned: { label: "Abandoned", color: "text-muted-foreground", bg: "bg-muted/40 border-border",               dotClass: "bg-muted-foreground/50", pulse: false },
};

function confidenceColor(c: number): string {
  if (c >= 95) return "bg-emerald-500";
  if (c >= 85) return "bg-blue-500";
  if (c >= 70) return "bg-amber-500";
  return "bg-red-500";
}

function confidenceTextColor(c: number): string {
  if (c >= 95) return "text-emerald-500";
  if (c >= 85) return "text-blue-400";
  if (c >= 70) return "text-amber-400";
  return "text-red-400";
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ExperimentStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass} ${cfg.pulse ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

function MetricCard({ label, value, sub, positive }: { label: string; value: string | number; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className={`text-2xl font-bold tracking-tight leading-none tabular-nums ${positive ? "text-emerald-500" : "text-foreground"}`}>
        {value}
      </span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function ExperimentCard({
  experiment,
  onToggle,
}: {
  experiment: Experiment;
  onToggle: (id: string, newStatus: ExperimentStatus) => void;
}) {
  const hasResults = experiment.variant_result !== null && experiment.improvement !== null;
  const isPositive = hasResults && experiment.improvement!.startsWith("+");

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-border/80 transition-colors">
      <div className="px-5 py-4 border-b border-border/50 flex items-start gap-3">
        <StatusBadge status={experiment.status} />
        {experiment.startedAt && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
            <Clock className="h-3 w-3" />
            Started {relativeTime(experiment.startedAt)}
          </span>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        <div className="space-y-1.5">
          <h3 className="text-[14px] font-semibold text-foreground leading-snug">{experiment.name}</h3>
          <p className="text-[12px] italic text-muted-foreground leading-relaxed">{experiment.hypothesis}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/30 rounded-lg p-3.5 border border-border/50 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 rounded bg-muted border border-border">
              A · Control
            </span>
            <p className="text-[12px] font-medium text-foreground">{experiment.variant_a}</p>
            {experiment.n > 0 && (
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">{experiment.metric}</span>
                <p className="text-[16px] font-bold text-foreground tabular-nums">{experiment.baseline}%</p>
              </div>
            )}
          </div>

          <div className={`rounded-lg p-3.5 border space-y-2 ${
            hasResults && isPositive  ? "bg-emerald-500/5 border-emerald-500/20" :
            hasResults && !isPositive ? "bg-red-500/5 border-red-500/20"         :
                                        "bg-muted/30 border-border/50"
          }`}>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                hasResults && isPositive  ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" :
                hasResults && !isPositive ? "text-red-400 bg-red-500/10 border-red-500/20"             :
                                            "text-muted-foreground bg-muted border-border"
              }`}>
                B · Challenger
              </span>
              {hasResults && experiment.improvement && (
                <span className={`text-[11px] font-bold ml-auto flex items-center gap-0.5 ${isPositive ? "text-emerald-500" : "text-red-400"}`}>
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
            {experiment.n === 0 && (
              <p className="text-[11px] text-muted-foreground italic">Not started yet</p>
            )}
          </div>
        </div>

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

        {experiment.n > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>n = <span className="font-semibold text-foreground tabular-nums">{experiment.n.toLocaleString()}</span> participants</span>
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20 px-3.5 py-3">
          <Brain className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">AI Insight</span>
            <p className="text-[12px] text-foreground leading-snug">{experiment.aiInsight}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {experiment.status === "planned" && (
            <Button size="sm" className="h-8 text-[11px] px-2.5 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0" onClick={() => onToggle(experiment.id, "running")}>
              <Play className="h-3 w-3" /> Launch
            </Button>
          )}
          {experiment.status === "running" && (
            <>
              <Button size="sm" variant="outline" className="h-8 text-[11px] px-2.5 gap-1" onClick={() => onToggle(experiment.id, "paused")}>
                <Pause className="h-3 w-3" /> Pause
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-[11px] px-2.5 gap-1 text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10" onClick={() => onToggle(experiment.id, "completed")}>
                <CheckCircle2 className="h-3 w-3" /> Complete
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-[11px] px-2.5 gap-1 text-muted-foreground hover:text-red-400" onClick={() => onToggle(experiment.id, "abandoned")}>
                <StopCircle className="h-3 w-3" /> Abandon
              </Button>
            </>
          )}
          {experiment.status === "paused" && (
            <>
              <Button size="sm" variant="outline" className="h-8 text-[11px] px-2.5 gap-1" onClick={() => onToggle(experiment.id, "running")}>
                <Play className="h-3 w-3" /> Resume
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-[11px] px-2.5 gap-1 text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10" onClick={() => onToggle(experiment.id, "completed")}>
                <CheckCircle2 className="h-3 w-3" /> Complete
              </Button>
            </>
          )}
          {experiment.status === "completed" && (
            <Button size="sm" className="h-8 text-[11px] px-3 gap-1.5 ml-auto bg-emerald-600 hover:bg-emerald-700 text-white border-0">
              <Zap className="h-3 w-3" /> Implement Winner
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function LearningLoop({ experiments }: { experiments: Experiment[] }) {
  const completed = experiments.filter(
    (e) => e.status === "completed" && e.aiInsight && !e.aiInsight.startsWith("No AI insight")
  );

  if (completed.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-center text-xs text-muted-foreground">
        Complete experiments to build your learning loop.
      </div>
    );
  }

  const positiveLifts = experiments
    .filter((e) => e.improvement?.startsWith("+"))
    .map((e) => parseFloat(e.improvement!.replace("+", "").replace("%", "")))
    .filter((n) => !isNaN(n));

  const avgLift = positiveLifts.length > 0
    ? Math.round(positiveLifts.reduce((a, b) => a + b, 0) / positiveLifts.length)
    : 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[13px] font-semibold text-foreground">Learning Loop</span>
        <span className="text-[11px] text-muted-foreground ml-1">— insights extracted and applied</span>
      </div>
      <div className="p-5 space-y-3">
        {completed.slice(0, 3).map((exp) => (
          <div key={exp.id} className="flex items-start gap-3 rounded-lg border p-4 bg-emerald-500/10 border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-[12.5px] text-foreground leading-snug font-medium">{exp.name}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">{exp.aiInsight}</p>
              {exp.improvement && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                  {exp.improvement} improvement · completed
                </span>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
              <CheckCircle2 className="h-3 w-3" />
              Done
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 pb-5">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center border border-border/50 space-y-0.5">
            <p className="text-[18px] font-bold text-emerald-500 tabular-nums leading-none">
              {avgLift > 0 ? `+${avgLift}%` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">Avg improvement</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center border border-border/50 space-y-0.5">
            <p className="text-[18px] font-bold text-blue-400 tabular-nums leading-none flex items-center justify-center gap-0.5">
              {positiveLifts.length}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </p>
            <p className="text-[10px] text-muted-foreground">Positive results</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center border border-border/50 space-y-0.5">
            <p className="text-[18px] font-bold text-foreground tabular-nums leading-none">{completed.length}</p>
            <p className="text-[10px] text-muted-foreground">Learnings applied</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── generate hypotheses modal ───────────────────────────────────────────────

interface GeneratedHypothesis {
  title: string;
  hypothesis: string;
  targetMetric: string;
  rationale: string;
}

interface GenerateHypothesesModalProps {
  onClose: () => void;
  onUse: (h: GeneratedHypothesis) => void;
  user: { getIdToken: () => Promise<string> } | null;
  workspaceId: string | null | undefined;
}

function GenerateHypothesesModal({ onClose, onUse, user, workspaceId }: GenerateHypothesesModalProps) {
  const [context, setContext]         = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [results, setResults]         = useState<GeneratedHypothesis[]>([]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || context.trim().length < 10) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/experiments/hypotheses", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ context: context.trim(), workspaceId: workspaceId ?? null }),
      });
      const body = await res.json() as { ok: boolean; data?: { hypotheses: GeneratedHypothesis[] }; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? `Request failed: ${res.status}`);
      setResults(body.data?.hypotheses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-[14px] font-semibold text-foreground">Generate Hypotheses</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">
              What are you trying to improve? <span className="text-muted-foreground/60">(min 10 chars)</span>
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. Our activation rate is low — users sign up but don't complete onboarding. We think the setup flow is too long."
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right tabular-nums">{context.length} / 2000</p>
          </div>
          <Button type="submit" size="sm" className="w-full gap-1.5 text-[12px]" disabled={loading || context.trim().length < 10}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {loading ? "Generating…" : "Generate 3 Hypotheses"}
          </Button>
        </form>

        {results.length > 0 && (
          <div className="space-y-3 pt-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              {results.length} hypotheses generated — pick one to start an experiment
            </p>
            {results.map((h, i) => (
              <div key={i} className="rounded-xl border border-border bg-muted/20 p-4 space-y-2 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-semibold text-foreground leading-snug">{h.title}</p>
                  <Button
                    size="sm"
                    className="shrink-0 h-7 text-[11px] px-2.5 gap-1"
                    onClick={() => onUse(h)}
                  >
                    Use this <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-[12px] italic text-muted-foreground leading-relaxed">{h.hypothesis}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    {h.targetMetric}
                  </span>
                  <p className="text-[11px] text-muted-foreground">{h.rationale}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── create experiment modal ──────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onCreate: (payload: {
    title: string; hypothesis: string; targetMetric: string;
    variants: { name: string; isControl: boolean }[];
  }) => Promise<void>;
  creating: boolean;
  error: string | null;
  prefill?: GeneratedHypothesis | null;
}

function CreateModal({ onClose, onCreate, creating, error, prefill }: CreateModalProps) {
  const [title, setTitle]       = useState(prefill?.title ?? "");
  const [hypothesis, setHypothesis] = useState(prefill?.hypothesis ?? "");
  const [metric, setMetric]     = useState(prefill?.targetMetric ?? "");
  const [controlName, setControlName]     = useState("Control");
  const [challengerName, setChallengerName] = useState("Challenger");

  const canSubmit = title.trim() && hypothesis.trim() && metric.trim() && controlName.trim() && challengerName.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    await onCreate({
      title:        title.trim(),
      hypothesis:   hypothesis.trim(),
      targetMetric: metric.trim(),
      variants: [
        { name: controlName.trim(),    isControl: true  },
        { name: challengerName.trim(), isControl: false },
      ],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <h2 className="text-[14px] font-semibold text-foreground">New Experiment</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New onboarding CTA test"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Hypothesis</label>
            <textarea
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="If we change X, then Y will improve because Z."
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Target Metric</label>
            <input
              type="text"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              placeholder="e.g. conversion_rate, DAU, signup_rate"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Control (A)</label>
              <input
                type="text"
                value={controlName}
                onChange={(e) => setControlName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Challenger (B)</label>
              <input
                type="text"
                value={challengerName}
                onChange={(e) => setChallengerName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="flex-1 text-[12px]" onClick={onClose} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="flex-1 text-[12px] gap-1.5" disabled={creating || !canSubmit}>
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {creating ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function ExperimentsView() {
  const { user } = useAuth();
  const { preferences } = useExtensionPreferences();
  const workspaceId = preferences?.activeWorkspaceId;

  const { data: apiData, loading, error, refetch } = useApi<{ experiments: ApiExperiment[] }>(
    `/api/experiments${workspaceId ? `?workspaceId=${workspaceId}` : ""}`,
    { refreshInterval: 15_000 }
  );

  const { lastEvent } = useSpecklaBus();
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "experiment.started" || lastEvent.type === "experiment.completed") {
      refetch();
    }
  }, [lastEvent, refetch]);

  const experiments: Experiment[] = (apiData?.experiments ?? []).map(mapExperiment);

  const [filter, setFilter] = useState<ExperimentStatus | "all">("all");
  const [showCreateModal, setShowCreateModal]       = useState(false);
  const [creating, setCreating]                     = useState(false);
  const [createError, setCreateError]               = useState<string | null>(null);
  const [showHypothesesModal, setShowHypothesesModal] = useState(false);
  const [prefillHypothesis, setPrefillHypothesis]   = useState<GeneratedHypothesis | null>(null);

  const handleToggle = useCallback(async (id: string, newStatus: ExperimentStatus) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await fetch(`/api/experiments/${id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      refetch();
    } catch {
      // non-fatal
    }
  }, [user, refetch]);

  const handleCreate = useCallback(async (payload: {
    title: string; hypothesis: string; targetMetric: string;
    variants: { name: string; isControl: boolean }[];
  }) => {
    if (!user) return;
    setCreating(true);
    setCreateError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, workspaceId: workspaceId ?? null }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `Request failed: ${res.status}`);
      }
      setShowCreateModal(false);
      refetch();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create experiment");
    } finally {
      setCreating(false);
    }
  }, [user, workspaceId, refetch]);

  const planned   = experiments.filter((e) => e.status === "planned").length;
  const running   = experiments.filter((e) => e.status === "running").length;
  const completed = experiments.filter((e) => e.status === "completed").length;
  const paused    = experiments.filter((e) => e.status === "paused").length;

  const positiveImprovements = experiments
    .filter((e) => e.improvement?.startsWith("+"))
    .map((e) => parseFloat(e.improvement!.replace("+", "").replace("%", "")))
    .filter((n) => !isNaN(n));

  const avgImprovement = positiveImprovements.length > 0
    ? Math.round(positiveImprovements.reduce((a, b) => a + b, 0) / positiveImprovements.length)
    : 0;

  const filteredExperiments = filter === "all"
    ? experiments
    : experiments.filter((e) => e.status === filter);

  const COUNTS: Record<ExperimentStatus | "all", number> = {
    all:       experiments.length,
    planned,
    running,
    completed,
    paused,
    abandoned: experiments.filter((e) => e.status === "abandoned").length,
  };

  const filterOptions: Array<{ id: ExperimentStatus | "all"; label: string }> = [
    { id: "all",       label: "All"       },
    { id: "planned",   label: "Planned"   },
    { id: "running",   label: "Running"   },
    { id: "completed", label: "Completed" },
    { id: "paused",    label: "Paused"    },
    { id: "abandoned", label: "Abandoned" },
  ];

  return (
    <div className="h-full overflow-y-auto bg-background">
      {showHypothesesModal && (
        <GenerateHypothesesModal
          onClose={() => setShowHypothesesModal(false)}
          onUse={(h) => {
            setPrefillHypothesis(h);
            setShowHypothesesModal(false);
            setCreateError(null);
            setShowCreateModal(true);
          }}
          user={user}
          workspaceId={workspaceId}
        />
      )}
      {showCreateModal && (
        <CreateModal
          onClose={() => { setShowCreateModal(false); setPrefillHypothesis(null); }}
          onCreate={handleCreate}
          creating={creating}
          error={createError}
          prefill={prefillHypothesis}
        />
      )}
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
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {running > 0 && (
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {running} running
              </span>
            )}
            <Button size="sm" className="h-7 text-[11px] gap-1 px-2.5" onClick={() => { setCreateError(null); setShowCreateModal(true); }}>
              <Plus className="h-3 w-3" /> New Experiment
            </Button>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Planned"         value={planned}                                                           sub="queued"            />
          <MetricCard label="Running"         value={running}                                                           sub="active tests"      />
          <MetricCard label="Completed"       value={completed}                                                         sub="with results"      />
          <MetricCard label="Avg Improvement" value={avgImprovement > 0 ? `+${avgImprovement}%` : "—"}                 sub="positive variants" positive={avgImprovement > 0} />
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            {filterOptions.map((opt) => {
              const count = COUNTS[opt.id];
              // Hide filter options with zero items (except "all" and active filter)
              if (count === 0 && opt.id !== "all" && filter !== opt.id) return null;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFilter(opt.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                    filter === opt.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  {opt.label}
                  {count > 0 && (
                    <span className={`text-[10px] font-bold tabular-nums rounded-full px-1 min-w-[16px] text-center leading-4 ${
                      filter === opt.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <span className="text-[11px] text-muted-foreground ml-2">
            {filteredExperiments.length} experiment{filteredExperiments.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Experiment cards */}
        <div className="space-y-4">
          {loading && experiments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/60 rounded-2xl bg-card/40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
              <p className="text-[13px] font-semibold text-foreground">Loading experiments…</p>
            </div>
          ) : filteredExperiments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/60 rounded-2xl bg-card/40">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <FlaskConical className="h-5 w-5 text-primary" />
              </div>
              <p className="text-[13px] font-semibold text-foreground">
                {filter === "all" ? "No experiments yet" : `No ${filter} experiments`}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {filter === "all" ? "Create your first experiment to start testing hypotheses." : "Try a different filter."}
              </p>
            </div>
          ) : (
            filteredExperiments.map((experiment) => (
              <ExperimentCard key={experiment.id} experiment={experiment} onToggle={handleToggle} />
            ))
          )}
        </div>

        {/* Experiment health summary */}
        {experiments.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Experiment Health</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <span className="text-[22px] font-bold text-foreground tabular-nums leading-none">
                  {experiments.reduce((sum, e) => sum + e.n, 0).toLocaleString()}
                </span>
                <p className="text-[11px] text-muted-foreground">Total Participants</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[22px] font-bold text-emerald-500 tabular-nums leading-none">
                    {experiments.filter((e) => e.confidence !== null && e.confidence >= 90).length}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    of {experiments.filter((e) => e.confidence !== null).length}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">High Confidence</p>
              </div>
              <div className="space-y-1">
                <span className="text-[22px] font-bold text-foreground tabular-nums leading-none">
                  {positiveImprovements.length}
                </span>
                <p className="text-[11px] text-muted-foreground">Positive Results</p>
              </div>
              <div className="space-y-1">
                <span className="text-[22px] font-bold text-emerald-500 tabular-nums leading-none flex items-center gap-1">
                  {avgImprovement > 0 ? `+${avgImprovement}%` : "—"}
                  {avgImprovement > 0 && <TrendingUp className="h-4 w-4" />}
                </span>
                <p className="text-[11px] text-muted-foreground">Avg Uplift</p>
              </div>
            </div>
          </div>
        )}

        {/* Learning loop */}
        <LearningLoop experiments={experiments} />

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
          <Button size="sm" className="shrink-0 gap-1.5 h-8 text-[11px]" onClick={() => setShowHypothesesModal(true)}>
            <Lightbulb className="h-3.5 w-3.5" />
            Generate Hypotheses
          </Button>
        </div>

        {/* Planned / not-started experiments */}
        {experiments.filter((e) => e.status === "planned" || (e.n === 0 && e.status !== "running")).length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[13px] font-semibold text-foreground">Not Yet Started</span>
              <span className="text-[11px] text-muted-foreground ml-1">
                — {experiments.filter((e) => e.status === "planned" || (e.n === 0 && e.status !== "running")).length} queued
              </span>
            </div>
            <ul>
              {experiments
                .filter((e) => e.status === "planned" || (e.n === 0 && e.status !== "running"))
                .map((exp, idx, arr) => (
                  <li
                    key={exp.id}
                    className={`flex items-start gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors ${idx < arr.length - 1 ? "border-b border-border/50" : ""}`}
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
                      <Button
                        size="sm" variant="ghost" className="h-7 text-[11px] px-2 gap-1"
                        onClick={() => handleToggle(exp.id, "running")}
                      >
                        Launch <ChevronRight className="h-3 w-3" />
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
