"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  Activity,
  Zap,
  Target,
  GitBranch,
  CheckCircle2,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

// ── Types ─────────────────────────────────────────────────────────────────────

type StepStatus = "complete" | "active" | "pending";
type StepCta    = "View Analysis" | "Inspect Signals" | "Open Reasoning";

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

// ── Data ──────────────────────────────────────────────────────────────────────

const TIMELINE_STEPS: TimelineStep[] = [
  {
    id: "01", label: "Problem Framed", status: "complete",
    summary: "47 user interviews and session recordings identified checkout abandonment at the payment step as the primary drop-off point, with a 68% abandonment rate on mobile.",
    signals: 24, confidence: 94, contradiction: 8, coverage: 89, cta: "View Analysis",
  },
  {
    id: "02", label: "Signals Extracted", status: "complete",
    summary: "AI extracted 24 high-confidence signals pointing to cognitive overload from excessive form fields and trust gaps in the payment UI.",
    signals: 24, confidence: 91, contradiction: 12, coverage: 85, cta: "Inspect Signals",
  },
  {
    id: "03", label: "Strategic Tensions", status: "active",
    summary: "Core tension: speed-to-ship vs. migration risk. Three competing hypotheses around single-page checkout, progressive disclosure, and guest checkout optimisation.",
    signals: 18, confidence: 78, contradiction: 31, coverage: 72, cta: "Open Reasoning",
  },
  {
    id: "04", label: "Recommendation Engine", status: "pending",
    summary: "Pending signal triangulation across engineering estimates, competitor benchmarks, and revenue impact modelling.",
    signals: 0, confidence: 0, contradiction: 0, coverage: 0, cta: "View Analysis",
  },
  {
    id: "05", label: "Decision Outcome", status: "pending",
    summary: "Awaiting final recommendation from the engine.",
    signals: 0, confidence: 0, contradiction: 0, coverage: 0, cta: "Open Reasoning",
  },
];

const SIGNALS = [
  { label: "Pattern Detected",      color: "amber"   },
  { label: "Retention Risk",        color: "red"     },
  { label: "Strong Market Pull",    color: "emerald" },
  { label: "Emerging Opportunity",  color: "blue"    },
] as const;

type SignalColor = "amber" | "red" | "emerald" | "blue";

const SIGNAL_STYLES: Record<SignalColor, { bg: string; text: string }> = {
  amber:   { bg: "bg-amber-100",   text: "text-amber-800"   },
  red:     { bg: "bg-red-100",     text: "text-red-800"     },
  emerald: { bg: "bg-emerald-100", text: "text-emerald-800" },
  blue:    { bg: "bg-blue-100",    text: "text-blue-800"    },
};

const CONTRADICTIONS = [
  "Engineering estimates conflict with PM timeline by 3 weeks",
  "User preference for guest checkout conflicts with retention data",
];

// ── Step status config ────────────────────────────────────────────────────────

const STEP_CFG: Record<StepStatus, { dot: string; label: string; Icon: React.ElementType }> = {
  complete: { dot: "bg-emerald-500", label: "Complete",    Icon: CheckCircle2 },
  active:   { dot: "bg-amber-500",   label: "In Progress", Icon: Activity     },
  pending:  { dot: "bg-slate-300",   label: "Pending",     Icon: Clock        },
};

// ── Components ────────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-[20px] font-bold text-slate-900 dark:text-slate-50 leading-[28px] tracking-tight mb-5">
      {children}
    </h2>
  );
}

function AIUnderstandingCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Amber top bar */}
      <div className="h-1 bg-amber-500" />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.08em] text-amber-600 mb-1">
              AI Product Understanding
            </p>
            <h3 className="font-heading text-[18px] font-bold text-slate-900 dark:text-slate-50 leading-snug">
              Mobile Checkout Redesign
            </h3>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 border border-amber-200 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-glow-pulse" />
            <span className="text-[11px] font-semibold text-amber-700 font-mono">87% Confidence</span>
          </div>
        </div>

        {/* Summary */}
        <p className="text-[15px] leading-[24px] text-slate-600 dark:text-slate-400 mb-6">
          Users abandon checkout due to friction in the payment flow. Evidence strongly suggests
          a streamlined 2-step checkout with saved payment methods would increase conversion by{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-100">23–31%</span>.
        </p>

        {/* Evidence quote */}
        <div className="evidence-quote mb-6">
          "It felt like filling out a tax form just to buy a $15 product" — User interview #31, Mobile cohort
        </div>

        {/* 3-col grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {[
            {
              Icon: TrendingUp,
              color: "text-emerald-600",
              bg:    "bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800",
              label: "Opportunity",
              value: "Reduce checkout steps 6→2, targeting mobile-first 18–35 cohort",
            },
            {
              Icon: AlertTriangle,
              color: "text-amber-600",
              bg:    "bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800",
              label: "Key Risk",
              value: "Payment gateway migration may delay Q3 launch by 2–4 weeks",
            },
            {
              Icon: Zap,
              color: "text-blue-600",
              bg:    "bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800",
              label: "Signal Strength",
              value: "24 high-confidence signals across 47 interviews and session data",
            },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded border p-3.5 ${item.bg}`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <item.Icon className={`w-3.5 h-3.5 ${item.color}`} />
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${item.color}`}>
                  {item.label}
                </span>
              </div>
              <p className="text-[12px] leading-[18px] text-slate-600 dark:text-slate-400">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineStepCard({ step, isLast }: { step: TimelineStep; isLast: boolean }) {
  const [expanded, setExpanded] = useState(step.status === "active");
  const cfg = STEP_CFG[step.status];
  const StatusIcon = cfg.Icon;

  const metrics = [
    { label: "Signals",       value: step.signals,       suffix: ""  },
    { label: "Confidence",    value: step.confidence,    suffix: "%" },
    { label: "Contradiction", value: step.contradiction, suffix: "%" },
    { label: "Coverage",      value: step.coverage,      suffix: "%" },
  ];

  return (
    <div className="relative flex gap-4">
      {/* Step indicator + connector */}
      <div className="flex flex-col items-center w-8 shrink-0 pt-3">
        <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot} ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${
          step.status === "active" ? "ring-amber-300" :
          step.status === "complete" ? "ring-emerald-200" : "ring-slate-200"
        }`} />
        {!isLast && (
          <div className={`w-px flex-1 mt-1.5 ${
            step.status === "complete" ? "bg-emerald-200 dark:bg-emerald-800" :
            step.status === "active"   ? "bg-amber-200  dark:bg-amber-800"    : "bg-slate-200 dark:bg-slate-700"
          }`} style={{ minHeight: 24 }} />
        )}
      </div>

      {/* Card */}
      <div className="flex-1 pb-5">
        <button
          type="button"
          disabled={step.status === "pending"}
          onClick={() => setExpanded((v) => !v)}
          className={`w-full text-left rounded border transition-all duration-100 ${
            step.status === "active"
              ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 shadow-sm"
              : step.status === "complete"
              ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 hover:border-slate-300"
              : "border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 opacity-60 cursor-default"
          }`}
        >
          <div className="px-4 py-3">
            {/* Step header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-600">
                  {step.id}
                </span>
                <StatusIcon className={`w-3.5 h-3.5 ${
                  step.status === "complete" ? "text-emerald-500" :
                  step.status === "active"   ? "text-amber-500"   : "text-slate-400"
                }`} />
                <span className={`text-[13px] font-semibold ${
                  step.status === "pending" ? "text-slate-400 dark:text-slate-600" : "text-slate-900 dark:text-slate-100"
                }`}>
                  {step.label}
                </span>
                {step.status === "active" && (
                  <span className="badge badge-amber">{cfg.label}</span>
                )}
                {step.status === "complete" && (
                  <span className="badge badge-emerald">{cfg.label}</span>
                )}
              </div>
              {step.status !== "pending" && (
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-150 shrink-0 ${
                    expanded ? "rotate-180" : ""
                  }`}
                />
              )}
            </div>

            {/* Expanded body */}
            {expanded && step.status !== "pending" && (
              <div className="mt-3 animate-fade-up">
                <p className="text-[13px] leading-[20px] text-slate-600 dark:text-slate-400 mb-4">
                  {step.summary}
                </p>

                {/* Metrics row */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {metrics.map((m) => (
                    <div
                      key={m.label}
                      className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-center"
                    >
                      <div className="text-[15px] font-bold text-slate-900 dark:text-slate-100 font-mono leading-tight">
                        {m.value}<span className="text-[11px] text-slate-400">{m.suffix}</span>
                      </div>
                      <div className="text-[9px] uppercase tracking-wide text-slate-500 mt-0.5">
                        {m.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-600 hover:text-amber-700 transition-colors"
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

function DecisionStrengthCard({ score }: { score: number }) {
  const R = 38;
  const circ = 2 * Math.PI * R;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        <Target className="w-4 h-4 text-amber-600" />
        <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">Decision Strength</span>
      </div>
      <p className="text-[11px] text-slate-500 mb-4">Based on 18 triangulated signals</p>

      {/* Ring */}
      <div className="flex justify-center mb-5">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#D97706" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r={R} fill="none" stroke="#F1F5F9" strokeWidth="8" className="dark:stroke-slate-700" />
            <circle cx="50" cy="50" r={R} fill="none" stroke="url(#ringGrad)"
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.25,0.46,0.45,0.94)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[28px] font-bold font-mono text-slate-900 dark:text-slate-100 leading-none">{score}</span>
            <span className="text-[10px] text-slate-400 mt-0.5">/ 100</span>
          </div>
        </div>
      </div>

      {/* Sub-metrics */}
      <div className="space-y-3">
        {[
          { label: "Evidence Quality",   pct: 91 },
          { label: "Signal Clarity",     pct: 84 },
          { label: "Decision Readiness", pct: 73 },
        ].map((m) => (
          <div key={m.label}>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-500">{m.label}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{m.pct}%</span>
            </div>
            <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-1000"
                style={{ width: `${m.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AISignalsCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-amber-600" />
        <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">AI Signals</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {SIGNALS.map((s) => {
          const st = SIGNAL_STYLES[s.color];
          return (
            <span
              key={s.label}
              className={`badge ${st.bg} ${st.text}`}
            >
              {s.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function RecommendationCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-amber-200 dark:border-amber-800 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-500">
          AI Recommendation
        </span>
      </div>
      <div className="p-5">
        <p className="text-[13px] leading-[20px] text-slate-600 dark:text-slate-400">
          Implement a{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            2-step checkout with guest option
          </span>{" "}
          targeting mobile users. Prioritise trust signals on the payment screen.
          Defer full account creation to post-purchase.
        </p>
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <p className="text-[11px] text-slate-500 font-mono">
            <span className="font-bold text-amber-600">78% confidence</span> — validate with A/B test before full rollout.
          </p>
        </div>
      </div>
    </div>
  );
}

function ContradictionsCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">Unresolved Tensions</span>
        <span className="ml-auto badge badge-amber">{CONTRADICTIONS.length} open</span>
      </div>
      <div className="space-y-2">
        {CONTRADICTIONS.map((c, i) => (
          <div key={i} className="flex gap-3 rounded border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 px-3 py-2.5">
            <div className="w-0.5 rounded-full bg-red-400 shrink-0 self-stretch" style={{ minHeight: 12 }} />
            <p className="text-[12px] leading-[18px] text-slate-600 dark:text-slate-400">{c}</p>
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
    <div className="flex h-full overflow-hidden bg-slate-50 dark:bg-slate-900">

      {/* ── Main intelligence feed ── */}
      <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
        <div className="max-w-2xl mx-auto px-6 py-8">

          {/* Page header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-amber">In Progress</span>
              <span className="text-[11px] font-mono text-slate-400">·</span>
              <span className="text-[11px] font-mono text-slate-400">Updated 2h ago</span>
            </div>
            <h1 className="font-heading text-[28px] font-bold text-slate-900 dark:text-slate-50 leading-[36px] tracking-tight">
              {currentDoc?.title || "Product Decision Intelligence"}
            </h1>
            <p className="text-[13px] text-slate-500 mt-1">
              AI-powered analysis across 5 decision stages
            </p>
          </div>

          {/* AI Understanding */}
          <div className="mb-8">
            <AIUnderstandingCard />
          </div>

          {/* Decision Evolution */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <GitBranch className="w-4 h-4 text-slate-400" />
              <SectionHeading>Decision Evolution</SectionHeading>
              <span className="ml-auto text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                Stage 3 of 5
              </span>
            </div>
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

      {/* ── Right AI intelligence rail (xl+) ── */}
      <div className="hidden xl:flex flex-col w-[340px] shrink-0 overflow-y-auto custom-scrollbar border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="p-5 space-y-4">

          {/* Rail header */}
          <div className="flex items-center gap-2 py-1 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-glow-pulse" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              AI Intelligence Rail
            </span>
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
