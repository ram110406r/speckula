"use client";

import React, { useState } from "react";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  Activity,
  Zap,
  Target,
  Brain,
  GitBranch,
  CheckCircle2,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

// ── Types ─────────────────────────────────────────────────────────────────────

type StepStatus = "complete" | "active" | "pending";
type StepCta = "View Analysis" | "Inspect Signals" | "Open Reasoning";
type SignalVariant = "purple" | "red" | "cyan" | "blue" | "amber";

interface TimelineStep {
  id: string;
  label: string;
  status: StepStatus;
  summary: string;
  signals: number;
  confidence: number;
  contradiction: number;
  coverage: number;
  cta: StepCta;
}

interface AISignal {
  label: string;
  variant: SignalVariant;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const TIMELINE_STEPS: TimelineStep[] = [
  {
    id: "01",
    label: "Problem Framed",
    status: "complete",
    summary:
      "47 user interviews and session recordings identified checkout abandonment at the payment step as the primary drop-off point, with a 68% abandonment rate on mobile.",
    signals: 24,
    confidence: 94,
    contradiction: 8,
    coverage: 89,
    cta: "View Analysis",
  },
  {
    id: "02",
    label: "Signals Extracted",
    status: "complete",
    summary:
      "AI extracted 24 high-confidence signals pointing to cognitive overload from excessive form fields and trust gaps in the payment UI.",
    signals: 24,
    confidence: 91,
    contradiction: 12,
    coverage: 85,
    cta: "Inspect Signals",
  },
  {
    id: "03",
    label: "Strategic Tensions",
    status: "active",
    summary:
      "Core tension: speed-to-ship vs. migration risk. Three competing hypotheses around single-page checkout, progressive disclosure, and guest checkout optimization.",
    signals: 18,
    confidence: 78,
    contradiction: 31,
    coverage: 72,
    cta: "Open Reasoning",
  },
  {
    id: "04",
    label: "Recommendation Engine",
    status: "pending",
    summary:
      "Pending signal triangulation across engineering estimates, competitor benchmarks, and revenue impact modelling.",
    signals: 0,
    confidence: 0,
    contradiction: 0,
    coverage: 0,
    cta: "View Analysis",
  },
  {
    id: "05",
    label: "Decision Outcome",
    status: "pending",
    summary: "Awaiting final recommendation from the engine.",
    signals: 0,
    confidence: 0,
    contradiction: 0,
    coverage: 0,
    cta: "Open Reasoning",
  },
];

const AI_SIGNALS: AISignal[] = [
  { label: "Pattern Detected", variant: "purple" },
  { label: "Retention Risk", variant: "red" },
  { label: "Strong Market Pull", variant: "cyan" },
  { label: "Emerging Opportunity", variant: "blue" },
];

const CONTRADICTIONS = [
  "Engineering estimates conflict with PM timeline by 3 weeks",
  "User preference for guest checkout conflicts with retention data",
];

// ── Design tokens (local) ─────────────────────────────────────────────────────

const C = {
  purple: "#8B5CF6",
  blue:   "#4F8CFF",
  cyan:   "#22D3EE",
  green:  "#22C55E",
  amber:  "#F59E0B",
  red:    "#EF4444",
  bg:     "#050816",
  card:   "rgba(18,24,38,0.70)",
  border: "rgba(255,255,255,0.06)",
  text: {
    primary:   "rgba(255,255,255,0.90)",
    secondary: "rgba(255,255,255,0.60)",
    muted:     "rgba(255,255,255,0.30)",
  },
} as const;

const SIGNAL_STYLES: Record<SignalVariant, { bg: string; text: string; border: string }> = {
  purple: { bg: "rgba(139,92,246,0.15)",  text: "#C4A5FA", border: "rgba(139,92,246,0.30)" },
  red:    { bg: "rgba(239,68,68,0.12)",   text: "#FCA5A5", border: "rgba(239,68,68,0.30)" },
  cyan:   { bg: "rgba(34,211,238,0.12)",  text: "#67E8F9", border: "rgba(34,211,238,0.30)" },
  blue:   { bg: "rgba(79,140,255,0.12)",  text: "#93C5FD", border: "rgba(79,140,255,0.30)" },
  amber:  { bg: "rgba(245,158,11,0.12)",  text: "#FCD34D", border: "rgba(245,158,11,0.30)" },
};

const STEP_CONFIG: Record<StepStatus, { color: string; Icon: React.ElementType; label: string }> = {
  complete: { color: C.green,  Icon: CheckCircle2, label: "Complete"    },
  active:   { color: C.purple, Icon: Activity,     label: "In Progress" },
  pending:  { color: "#5B6472", Icon: Clock,       label: "Pending"     },
};

// ── Floating particles ────────────────────────────────────────────────────────

const PARTICLES = [
  { top: "14%", left: "8%",  dur: "6s", del: "0s"   },
  { top: "28%", left: "82%", dur: "7s", del: "1.2s" },
  { top: "58%", left: "22%", dur: "5s", del: "2.1s" },
  { top: "72%", left: "68%", dur: "8s", del: "0.8s" },
  { top: "44%", left: "48%", dur: "6s", del: "3.0s" },
  { top: "18%", left: "58%", dur: "9s", del: "1.5s" },
  { top: "85%", left: "35%", dur: "7s", del: "2.7s" },
  { top: "38%", left: "90%", dur: "5s", del: "0.4s" },
];

function ParticleField() {
  return (
    <div className="particle-field" aria-hidden>
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className="particle"
          style={{ top: p.top, left: p.left, "--p-dur": p.dur, "--p-del": p.del } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ── AI Product Understanding ───────────────────────────────────────────────────

function AIUnderstandingCard() {
  return (
    <div
      className="relative rounded-2xl overflow-hidden gradient-border-card animate-ai-breathe"
      style={{ background: "linear-gradient(135deg,rgba(5,8,22,0.96) 0%,rgba(18,24,38,0.92) 100%)" }}
    >
      <ParticleField />

      {/* Ambient glow blobs */}
      <div
        aria-hidden
        className="absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(139,92,246,0.25) 0%,transparent 70%)" }}
      />
      <div
        aria-hidden
        className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(79,140,255,0.18) 0%,transparent 70%)" }}
      />

      <div className="relative z-10 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(139,92,246,0.20)", border: `1px solid rgba(139,92,246,0.35)` }}
            >
              <Brain className="w-4 h-4" style={{ color: C.purple }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: C.text.primary }}>
              AI Product Understanding
            </span>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.28)", color: "#C4A5FA" }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-glow-pulse" style={{ background: C.purple }} />
            87% Confidence
          </div>
        </div>

        {/* Summary */}
        <p className="text-[15px] leading-relaxed mb-8" style={{ color: C.text.secondary }}>
          Users abandon checkout due to friction in the payment flow. Evidence strongly suggests a
          streamlined 2-step checkout with saved payment methods would increase conversion by{" "}
          <span className="font-semibold" style={{ color: "#C4A5FA" }}>23–31%</span>.
        </p>

        {/* 3-col insight grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              Icon: TrendingUp,
              color: C.cyan,
              label: "Main Opportunity",
              value: "Reduce checkout steps 6→2, targeting mobile-first 18–35 cohort",
            },
            {
              Icon: AlertTriangle,
              color: C.amber,
              label: "Key Risk",
              value: "Payment gateway migration may delay Q3 launch by 2–4 weeks",
            },
            {
              Icon: Activity,
              color: C.green,
              label: "Signal Strength",
              value: "24 high-confidence signals across 47 interviews and session data",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.04)", border: C.border }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <item.Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: `${item.color}99` }}
                >
                  {item.label}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: C.text.muted }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Timeline step card ────────────────────────────────────────────────────────

function TimelineStepCard({ step, isLast }: { step: TimelineStep; isLast: boolean }) {
  const [expanded, setExpanded] = useState(step.status === "active");
  const cfg = STEP_CONFIG[step.status];
  const StatusIcon = cfg.Icon;

  const metrics = [
    { label: "Signals",       value: step.signals,       suffix: ""  },
    { label: "Confidence",    value: step.confidence,    suffix: "%" },
    { label: "Contradiction", value: step.contradiction, suffix: "%" },
    { label: "Coverage",      value: step.coverage,      suffix: "%" },
  ];

  return (
    <div className="relative flex gap-5">
      {/* Node + connector */}
      <div className="flex flex-col items-center w-9 shrink-0">
        <div
          className={`relative w-9 h-9 rounded-full flex items-center justify-center z-10 ${
            step.status === "active" ? "animate-node-pulse" : ""
          }`}
          style={{
            background:
              step.status === "pending"
                ? "rgba(30,37,48,0.80)"
                : step.status === "complete"
                ? "rgba(34,197,94,0.12)"
                : "rgba(139,92,246,0.15)",
            border: `1.5px solid ${step.status === "pending" ? "rgba(91,100,114,0.35)" : cfg.color}`,
          }}
        >
          <StatusIcon className="w-4 h-4" style={{ color: cfg.color }} />
        </div>
        {!isLast && (
          <div
            className={`w-px flex-1 mt-1 ${step.status !== "pending" ? "animate-timeline-glow" : ""}`}
            style={{
              minHeight: 28,
              background:
                step.status !== "pending"
                  ? `linear-gradient(to bottom, ${cfg.color}, rgba(139,92,246,0.08))`
                  : "rgba(30,37,48,0.55)",
            }}
          />
        )}
      </div>

      {/* Card */}
      <div className="flex-1 pb-6">
        <button
          type="button"
          disabled={step.status === "pending"}
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-left rounded-xl transition-all duration-250 disabled:opacity-45 disabled:cursor-default"
          style={{
            background:
              step.status === "active" ? "rgba(139,92,246,0.08)" : "rgba(18,24,38,0.60)",
            border:
              step.status === "active"
                ? "1px solid rgba(139,92,246,0.28)"
                : `1px solid ${C.border}`,
          }}
        >
          <div className="p-4">
            {/* Step header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-mono font-bold tracking-[0.12em]" style={{ color: cfg.color }}>
                  {step.id}
                </span>
                <span className="text-sm font-semibold" style={{ color: C.text.primary }}>
                  {step.label}
                </span>
                {step.status === "active" && (
                  <span
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(139,92,246,0.20)", color: "#C4A5FA", border: "1px solid rgba(139,92,246,0.30)" }}
                  >
                    In Progress
                  </span>
                )}
              </div>
              {step.status !== "pending" && (
                <ChevronDown
                  className="w-4 h-4 shrink-0 transition-transform duration-200"
                  style={{
                    color: C.text.muted,
                    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              )}
            </div>

            {/* Expanded body */}
            {expanded && step.status !== "pending" && (
              <div className="mt-4 animate-fade-up">
                <p className="text-sm leading-relaxed mb-5" style={{ color: C.text.secondary }}>
                  {step.summary}
                </p>

                {/* Metrics grid */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {metrics.map((m) => (
                    <div
                      key={m.label}
                      className="rounded-lg p-2.5 text-center"
                      style={{ background: "rgba(255,255,255,0.04)", border: C.border }}
                    >
                      <div className="text-[15px] font-bold" style={{ color: C.text.primary }}>
                        {m.value}<span className="text-xs" style={{ color: C.text.muted }}>{m.suffix}</span>
                      </div>
                      <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: C.text.muted }}>
                        {m.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{ color: C.purple }}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {step.cta}
                </button>
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

// ── Decision Strength ─────────────────────────────────────────────────────────

function DecisionStrengthCard({ score }: { score: number }) {
  const R = 40;
  const circumference = 2 * Math.PI * R;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="rounded-xl p-5 gradient-border-card" style={{ background: C.card }}>
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4" style={{ color: C.purple }} />
        <span className="text-sm font-semibold" style={{ color: C.text.primary }}>Decision Strength</span>
      </div>

      {/* Radial score */}
      <div className="flex justify-center py-3">
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor={C.purple} />
                <stop offset="100%" stopColor={C.cyan}   />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            <circle
              cx="50" cy="50" r={R}
              fill="none"
              stroke="url(#scoreGrad)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.25,0.46,0.45,0.94)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold" style={{ color: C.text.primary }}>{score}</span>
            <span className="text-xs" style={{ color: C.text.muted }}>/&nbsp;100</span>
          </div>
        </div>
      </div>

      {/* Sub-metrics */}
      <div className="space-y-2.5 mt-1">
        {[
          { label: "Evidence Quality",    pct: 91 },
          { label: "Signal Clarity",      pct: 84 },
          { label: "Decision Readiness",  pct: 73 },
        ].map((m) => (
          <div key={m.label}>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: C.text.muted }}>{m.label}</span>
              <span className="font-medium" style={{ color: C.text.secondary }}>{m.pct}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${m.pct}%`,
                  background: `linear-gradient(to right,${C.purple},${C.cyan})`,
                  transition: "width 1.2s ease-out",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI Signals ────────────────────────────────────────────────────────────────

function AISignalsCard() {
  return (
    <div className="rounded-xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4" style={{ color: C.cyan }} />
        <span className="text-sm font-semibold" style={{ color: C.text.primary }}>AI Signals</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {AI_SIGNALS.map((s) => {
          const st = SIGNAL_STYLES[s.variant];
          return (
            <span
              key={s.label}
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}` }}
            >
              {s.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Recommendation ────────────────────────────────────────────────────────────

function RecommendationCard() {
  return (
    <div className="rounded-xl p-5 gradient-border-card" style={{ background: C.card }}>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4" style={{ color: C.purple }} />
        <span className="text-sm font-semibold" style={{ color: C.text.primary }}>Recommendation</span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: C.text.secondary }}>
        Implement a{" "}
        <span className="font-semibold" style={{ color: C.text.primary }}>2-step checkout with guest option</span>{" "}
        targeting mobile users. Prioritise trust signals on the payment screen. Defer full account creation to post-purchase.
      </p>
      <div
        className="mt-4 rounded-lg p-3 text-xs leading-relaxed"
        style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.22)", color: "#C4A5FA" }}
      >
        <span className="font-bold">Confidence 78%</span> — based on 18 triangulated signals. Validate with A/B test before full rollout.
      </div>
    </div>
  );
}

// ── Contradictions ────────────────────────────────────────────────────────────

function ContradictionsCard() {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: C.card, border: "1px solid rgba(239,68,68,0.16)" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4" style={{ color: C.amber }} />
        <span className="text-sm font-semibold" style={{ color: C.text.primary }}>Contradictions</span>
        <span
          className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(239,68,68,0.12)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.25)" }}
        >
          {CONTRADICTIONS.length} unresolved
        </span>
      </div>
      <div className="space-y-2">
        {CONTRADICTIONS.map((c, i) => (
          <div
            key={i}
            className="flex gap-2.5 rounded-lg p-3"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}
          >
            <div
              className="w-0.5 rounded-full shrink-0 self-stretch"
              style={{ background: C.red, minHeight: 12 }}
            />
            <p className="text-xs leading-relaxed" style={{ color: C.text.secondary }}>
              {c}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DashboardView ─────────────────────────────────────────────────────────────

export function DashboardView() {
  const { documents, currentDocId } = useAppStore();
  const currentDoc = documents.find((d) => d.id === currentDocId);

  return (
    <div className="flex h-full overflow-hidden" style={{ background: C.bg }}>

      {/* ── Main intelligence feed ── */}
      <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

          {/* Title */}
          <div>
            <h1 className="text-[28px] font-bold tracking-tight mb-1" style={{ color: C.text.primary }}>
              {currentDoc?.title || "Product Decision Intelligence"}
            </h1>
            <p className="text-sm" style={{ color: C.text.muted }}>
              AI-powered decision analysis · Continuously evolving
            </p>
          </div>

          {/* AI hero */}
          <AIUnderstandingCard />

          {/* Timeline */}
          <div>
            <div className="flex items-center gap-2.5 mb-6">
              <GitBranch className="w-4 h-4" style={{ color: C.purple }} />
              <h2 className="text-[15px] font-semibold" style={{ color: C.text.primary }}>
                Decision Evolution
              </h2>
              <span
                className="text-[9px] font-mono uppercase tracking-wider"
                style={{ color: C.text.muted }}
              >
                5 stages
              </span>
            </div>

            <div>
              {TIMELINE_STEPS.map((step, i) => (
                <TimelineStepCard
                  key={step.id}
                  step={step}
                  isLast={i === TIMELINE_STEPS.length - 1}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right AI intelligence rail (xl+) ── */}
      <div
        className="hidden xl:flex flex-col w-[360px] shrink-0 overflow-y-auto custom-scrollbar"
        style={{ borderLeft: `1px solid ${C.border}`, background: "rgba(5,8,22,0.60)" }}
      >
        <div className="p-5 space-y-4">

          {/* Rail header */}
          <div className="flex items-center gap-2 py-1">
            <Sparkles className="w-4 h-4" style={{ color: C.purple }} />
            <span className="text-sm font-semibold" style={{ color: C.text.secondary }}>
              AI Intelligence
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full animate-glow-pulse" style={{ background: C.cyan }} />
              <span className="text-[10px] font-mono" style={{ color: C.cyan }}>Live</span>
            </div>
          </div>

          <DecisionStrengthCard score={87} />
          <AISignalsCard />
          <RecommendationCard />
          <ContradictionsCard />
        </div>
      </div>

    </div>
  );
}
