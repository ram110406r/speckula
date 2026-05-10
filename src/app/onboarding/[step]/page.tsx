"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import {
  ChevronRight, ChevronLeft, Check, Lightbulb, Compass,
  LayoutDashboard, CheckSquare, Bot, Puzzle, Users, Sparkles
} from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  "welcome",
  "role",
  "goals",
  "team-size",
  "integrations",
  "extension",
  "first-signal",
  "done",
] as const;

type StepId = typeof STEPS[number];

// ─── Step components ──────────────────────────────────────────────────────────

function WelcomeStep({ name }: { name: string }) {
  return (
    <div className="text-center space-y-5">
      <div className="w-20 h-20 mx-auto flex items-center justify-center">
        <Image src="/logo.png" alt="Speckula" width={80} height={80} className="object-contain" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome to Speckula, {name}!</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          Your AI-powered product brain. Let's get you set up in 2 minutes so you can start making smarter product decisions.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto text-left">
        {[
          { icon: Lightbulb,      label: "Capture signals"      },
          { icon: Compass,        label: "Make decisions"        },
          { icon: LayoutDashboard, label: "Write specs with AI" },
          { icon: Bot,            label: "Autonomous research"   },
        ].map((f) => (
          <div key={f.label} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
            <f.icon className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs text-foreground">{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ROLES = [
  "Product Manager",
  "Senior PM",
  "Head of Product",
  "CPO / VP Product",
  "Founder / CEO",
  "Product Designer",
  "Other",
];

function RoleStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">What's your role?</h2>
        <p className="text-sm text-muted-foreground mt-1">We'll personalise your experience</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ROLES.map((role) => (
          <button
            key={role}
            onClick={() => onChange(role)}
            className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
              value === role
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 bg-card text-foreground hover:border-border hover:bg-muted/30"
            }`}
          >
            {role}
          </button>
        ))}
      </div>
    </div>
  );
}

const GOALS = [
  { id: "competitive",  label: "Track competitor moves",   icon: Compass    },
  { id: "decisions",    label: "Make better decisions",    icon: Lightbulb  },
  { id: "specs",        label: "Write specs faster",       icon: LayoutDashboard },
  { id: "team",         label: "Align my team",            icon: Users      },
  { id: "autonomous",   label: "Automate research",        icon: Bot        },
  { id: "tasks",        label: "Manage my backlog",        icon: CheckSquare },
];

function GoalsStep({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">What are you here to do?</h2>
        <p className="text-sm text-muted-foreground mt-1">Select all that apply</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {GOALS.map((g) => {
          const active = selected.includes(g.id);
          return (
            <button
              key={g.id}
              onClick={() => toggle(g.id)}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 bg-card text-foreground hover:border-border hover:bg-muted/30"
              }`}
            >
              {active
                ? <Check className="h-4 w-4 shrink-0" />
                : <g.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              }
              {g.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const TEAM_SIZES = ["Just me", "2–5", "6–15", "16–50", "50+"];

function TeamSizeStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">How big is your team?</h2>
        <p className="text-sm text-muted-foreground mt-1">We'll set up collaboration features accordingly</p>
      </div>
      <div className="space-y-2">
        {TEAM_SIZES.map((size) => (
          <button
            key={size}
            onClick={() => onChange(size)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
              value === size
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 bg-card text-foreground hover:border-border hover:bg-muted/30"
            }`}
          >
            {size}
            {value === size && <Check className="h-4 w-4" />}
          </button>
        ))}
      </div>
    </div>
  );
}

const AVAILABLE_INTEGRATIONS = [
  { id: "slack",   name: "Slack",   logo: "SL", color: "bg-[#4A154B] text-white", desc: "Get notified on decisions" },
  { id: "github",  name: "GitHub",  logo: "GH", color: "bg-[#24292E] text-white", desc: "Link tasks to PRs"         },
  { id: "notion",  name: "Notion",  logo: "NO", color: "bg-black text-white",      desc: "Export specs to Notion"   },
  { id: "jira",    name: "Jira",    logo: "JI", color: "bg-[#0052CC] text-white",  desc: "Sync your backlog"        },
];

function IntegrationsStep({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">Connect your tools</h2>
        <p className="text-sm text-muted-foreground mt-1">Skip for now — you can connect later in Integrations</p>
      </div>
      <div className="space-y-2">
        {AVAILABLE_INTEGRATIONS.map((integ) => {
          const active = selected.includes(integ.id);
          return (
            <button
              key={integ.id}
              onClick={() => toggle(integ.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                active ? "border-primary bg-primary/10" : "border-border/60 bg-card hover:border-border hover:bg-muted/30"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${integ.color}`}>
                {integ.logo}
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-foreground">{integ.name}</p>
                <p className="text-[11px] text-muted-foreground">{integ.desc}</p>
              </div>
              {active && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExtensionStep() {
  return (
    <div className="space-y-5 text-center">
      <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto">
        <Puzzle className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground">Install the Chrome extension</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          Capture insights from competitor sites, ProductHunt, Reddit and more — with one click while browsing.
        </p>
      </div>
      <div className="space-y-2 text-left max-w-xs mx-auto">
        {[
          "Analyse any page with one click",
          "AI classifies content automatically",
          "Insights sync to your workspace instantly",
        ].map((f) => (
          <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="h-3 w-3 text-green-500 shrink-0" />
            {f}
          </div>
        ))}
      </div>
      <a
        href="https://speckula.eddgeportal.com/extension"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        <Puzzle className="h-4 w-4" /> Install extension
      </a>
      <p className="text-[11px] text-muted-foreground">You can skip this and install later from the Extension page</p>
    </div>
  );
}

function FirstSignalStep() {
  const [text, setText] = useState("");
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">Add your first signal</h2>
        <p className="text-sm text-muted-foreground mt-1">
          A signal is any piece of evidence that informs your decisions — a user quote, a metric, a competitor move.
        </p>
      </div>
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-primary">New signal</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe what you observed… e.g. 'Competitor X launched one-click checkout today — could impact our conversion.'"
          rows={4}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none"
        />
      </div>
      <p className="text-[11px] text-muted-foreground text-center">
        You can also skip — we'll take you straight to the dashboard.
      </p>
    </div>
  );
}

function DoneStep({ name }: { name: string }) {
  return (
    <div className="text-center space-y-5">
      <div className="p-4 rounded-full bg-green-500/10 w-fit mx-auto">
        <Sparkles className="h-8 w-8 text-green-500" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-foreground">You're all set, {name}!</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          Your workspace is ready. Start by adding a signal, making a decision, or letting the AI autonomous mode research for you.
        </p>
      </div>
      <div className="flex flex-col gap-2 max-w-xs mx-auto">
        {[
          { icon: Lightbulb,      label: "Add your first signal",  href: "/?view=insights"  },
          { icon: Bot,            label: "Try Autonomous Mode",    href: "/?view=autonomous" },
          { icon: Puzzle,         label: "Set up the extension",   href: "/?view=extension"  },
        ].map((a) => (
          <a
            key={a.label}
            href={a.href}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/60 bg-card text-sm font-medium text-foreground hover:border-border hover:bg-muted/30 transition-all"
          >
            <a.icon className="h-4 w-4 text-primary shrink-0" />
            {a.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingStepPage() {
  const params   = useParams();
  const router   = useRouter();
  const { user } = useAuth();

  const stepParam = (params?.step as string) ?? "welcome";
  const stepIndex = STEPS.indexOf(stepParam as StepId);
  const currentStep: StepId = stepIndex >= 0 ? (stepParam as StepId) : "welcome";

  const [answers, setAnswers] = useState({
    role:         "",
    goals:        [] as string[],
    teamSize:     "",
    integrations: [] as string[],
  });

  const firstName = user?.displayName?.split(" ")[0] ?? "there";
  const progress  = ((stepIndex + 1) / STEPS.length) * 100;

  const goNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex >= STEPS.length) { router.push("/"); return; }
    router.push(`/onboarding/${STEPS[nextIndex]}`);
  };

  const goPrev = () => {
    if (stepIndex <= 0) return;
    router.push(`/onboarding/${STEPS[stepIndex - 1]}`);
  };

  const isLastStep = stepIndex === STEPS.length - 1;
  const canContinue = (() => {
    switch (currentStep) {
      case "role":      return !!answers.role;
      case "goals":     return answers.goals.length > 0;
      case "team-size": return !!answers.teamSize;
      default:          return true;
    }
  })();

  const renderStep = () => {
    switch (currentStep) {
      case "welcome":      return <WelcomeStep name={firstName} />;
      case "role":         return <RoleStep value={answers.role} onChange={(v) => setAnswers((a) => ({ ...a, role: v }))} />;
      case "goals":        return <GoalsStep selected={answers.goals} onChange={(v) => setAnswers((a) => ({ ...a, goals: v }))} />;
      case "team-size":    return <TeamSizeStep value={answers.teamSize} onChange={(v) => setAnswers((a) => ({ ...a, teamSize: v }))} />;
      case "integrations": return <IntegrationsStep selected={answers.integrations} onChange={(v) => setAnswers((a) => ({ ...a, integrations: v }))} />;
      case "extension":    return <ExtensionStep />;
      case "first-signal": return <FirstSignalStep />;
      case "done":         return <DoneStep name={firstName} />;
      default:             return <WelcomeStep name={firstName} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">

      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-7 h-7 flex items-center justify-center">
          <Image src="/logo.png" alt="Speckula" width={28} height={28} className="object-contain" />
        </div>
        <span className="text-base font-semibold tracking-tight text-foreground">Speckula</span>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm mb-6">
        <div className="h-1 rounded-full bg-border/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
          Step {stepIndex + 1} of {STEPS.length}
        </p>
      </div>

      {/* Step card */}
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-8 shadow-lg">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 mt-6">
        {stepIndex > 0 && !isLastStep && (
          <button
            onClick={goPrev}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        )}

        <button
          onClick={goNext}
          disabled={!canContinue}
          className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLastStep ? "Go to dashboard" : currentStep === "extension" || currentStep === "integrations" ? "Skip for now" : "Continue"}
          {!isLastStep && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {/* Step dots */}
      <div className="flex items-center gap-1.5 mt-5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === stepIndex ? "w-4 bg-primary" : i < stepIndex ? "w-1.5 bg-primary/40" : "w-1.5 bg-border/60"
            }`}
          />
        ))}
      </div>

    </div>
  );
}
