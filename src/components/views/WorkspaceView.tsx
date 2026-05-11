"use client";

import React, { useState } from "react";
import {
  BarChart3, Lightbulb, CheckSquare, Compass, LayoutDashboard,
  Zap, TrendingUp, Clock, ArrowRight, Brain, Puzzle,
  FileText, Users, Activity, Plus, ChevronRight,
  Sparkles, Target, AlertCircle
} from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";

// ─── mock data ────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: Lightbulb,      label: "Add Signal",       view: "market-intelligence" as const, color: "text-amber-500",  bg: "bg-amber-500/10"  },
  { icon: Compass,        label: "Make Decision",    view: "decisions"           as const, color: "text-blue-500",   bg: "bg-blue-500/10"   },
  { icon: LayoutDashboard, label: "Write Spec",      view: "specifications"      as const, color: "text-green-500",  bg: "bg-green-500/10"  },
  { icon: CheckSquare,    label: "Create Task",      view: "tasks"     as const, color: "text-purple-500", bg: "bg-purple-500/10" },
];

const RECENT_INTELLIGENCE = [
  { type: "signal",   title: "Users drop off at checkout step 3", time: "2h ago",  tag: "Conversion",  icon: TrendingUp,      color: "text-amber-500"  },
  { type: "decision", title: "Prioritize mobile checkout redesign", time: "5h ago", tag: "Product",    icon: Compass,         color: "text-blue-500"   },
  { type: "spec",     title: "Mobile Checkout v2 PRD",             time: "1d ago",  tag: "Spec",       icon: LayoutDashboard, color: "text-green-500"  },
  { type: "task",     title: "Implement address autofill",         time: "1d ago",  tag: "Engineering", icon: CheckSquare,    color: "text-purple-500" },
];

const TEAM_ACTIVITY = [
  { user: "Sarah K.",   avatar: "SK", action: "added signal",   subject: "Payment latency spike",      time: "10m ago", color: "bg-pink-500"   },
  { user: "James R.",   avatar: "JR", action: "made decision",  subject: "Use Stripe for payments",    time: "1h ago",  color: "bg-blue-500"   },
  { user: "Priya M.",   avatar: "PM", action: "created spec",   subject: "Checkout Flow Redesign",     time: "3h ago",  color: "bg-emerald-500"},
  { user: "Alex T.",    avatar: "AT", action: "completed task", subject: "Add form validation",        time: "5h ago",  color: "bg-amber-500"  },
];

const PHASE_HEALTH = [
  { phase: "Evidence",  count: 12, completeness: 85, color: "bg-amber-500",  icon: Lightbulb      },
  { phase: "Decisions", count:  8, completeness: 70, color: "bg-blue-500",   icon: Compass        },
  { phase: "Specs",     count:  3, completeness: 60, color: "bg-green-500",  icon: LayoutDashboard },
  { phase: "Tasks",     count: 24, completeness: 40, color: "bg-purple-500", icon: CheckSquare    },
];

// ─── sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, trend }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "—"}
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">{title}</h3>
      {action && (
        <button onClick={onAction} className="text-[11px] text-primary hover:underline flex items-center gap-0.5">
          {action} <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function WorkspaceView() {
  const { user } = useAuth();
  const { setActiveView, documents } = useAppStore();
  const [extensionConnected] = useState(false);

  const firstName = user?.displayName?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="h-full overflow-y-auto bg-background custom-scrollbar">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {greeting}, {firstName} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Here's what's happening in your workspace
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!extensionConnected && (
              <button
                onClick={() => setActiveView("extension")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 text-xs font-medium hover:bg-amber-500/20 transition-colors"
              >
                <Puzzle className="h-3 w-3" />
                Connect Extension
              </button>
            )}
            <button
              onClick={() => setActiveView("settings")}
              className="px-3 py-1.5 rounded-lg border border-border/60 text-muted-foreground text-xs hover:text-foreground hover:bg-muted transition-colors"
            >
              Settings
            </button>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Active analyses" value={documents.length || 3} icon={FileText} trend="up" />
          <StatCard label="Signals captured" value={12} sub="this week" icon={Lightbulb} trend="up" />
          <StatCard label="Decisions made" value={8} sub="this month" icon={Compass} trend="neutral" />
          <StatCard label="Tasks completed" value="18/24" sub="75% done" icon={CheckSquare} trend="up" />
        </div>

        {/* ── Quick actions ── */}
        <div>
          <SectionHeader title="Quick Actions" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => setActiveView(action.view)}
                className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-border/60 bg-card hover:border-border hover:bg-muted/40 transition-all text-center"
              >
                <div className={`p-2.5 rounded-lg ${action.bg} group-hover:scale-110 transition-transform`}>
                  <action.icon className={`h-4 w-4 ${action.color}`} />
                </div>
                <span className="text-xs font-medium text-foreground">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left column (3/5) */}
          <div className="lg:col-span-3 space-y-6">

            {/* Recent intelligence */}
            <div>
              <SectionHeader title="Recent Intelligence" action="View all" onAction={() => setActiveView("market-intelligence")} />
              <div className="space-y-1.5">
                {RECENT_INTELLIGENCE.map((item, i) => (
                  <div
                    key={i}
                    className="group flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card hover:border-border/70 hover:bg-muted/30 transition-all cursor-pointer"
                  >
                    <div className={`p-1.5 rounded-md bg-muted shrink-0`}>
                      <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.tag} · {item.time}</p>
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                  </div>
                ))}
              </div>
            </div>

            {/* Product Brain health */}
            <div>
              <SectionHeader title="Product Brain Health" />
              <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-foreground">Phase completeness</span>
                  <span className="ml-auto text-[10px] text-primary font-mono">64% overall</span>
                </div>
                {PHASE_HEALTH.map((ph) => (
                  <div key={ph.phase} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <ph.icon className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{ph.phase}</span>
                        <span className="text-muted-foreground/50">({ph.count})</span>
                      </div>
                      <span className="font-mono text-muted-foreground">{ph.completeness}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ph.color} transition-all`}
                        style={{ width: `${ph.completeness}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column (2/5) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Team activity */}
            <div>
              <SectionHeader title="Team Activity" action="All activity" onAction={() => setActiveView("activity")} />
              <div className="space-y-1">
                {TEAM_ACTIVITY.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className={`w-6 h-6 rounded-full ${item.color} flex items-center justify-center shrink-0 mt-0.5`}>
                      <span className="text-[9px] font-bold text-white">{item.avatar}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-foreground leading-snug">
                        <span className="font-medium">{item.user}</span>{" "}
                        <span className="text-muted-foreground">{item.action}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{item.subject}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Extension status */}
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Puzzle className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Extension</span>
                <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full ${extensionConnected ? "bg-green-500/15 text-green-600" : "bg-amber-500/15 text-amber-600"}`}>
                  {extensionConnected ? "Connected" : "Not connected"}
                </span>
              </div>
              {extensionConnected ? (
                <div className="space-y-1.5 text-[11px] text-muted-foreground">
                  <div className="flex justify-between"><span>Last sync</span><span className="text-foreground">2m ago</span></div>
                  <div className="flex justify-between"><span>Pages analyzed</span><span className="text-foreground">47</span></div>
                  <div className="flex justify-between"><span>Insights captured</span><span className="text-foreground">12</span></div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">Connect the Chrome extension to automatically capture competitive intelligence while browsing.</p>
                  <button
                    onClick={() => setActiveView("extension")}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Set up extension
                  </button>
                </div>
              )}
            </div>

            {/* AI suggestions */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">AI Suggestion</span>
              </div>
              <p className="text-[11px] text-foreground/80 leading-relaxed">
                You have 4 signals from competitor pricing pages. Consider making a pricing decision before writing your next spec.
              </p>
              <button
                onClick={() => setActiveView("decisions")}
                className="mt-2.5 flex items-center gap-1 text-[11px] text-primary font-medium hover:underline"
              >
                Make decision <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Upcoming / focus ── */}
        <div>
          <SectionHeader title="Focus Today" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Target,       label: "3 tasks due today",          sub: "Checkout redesign sprint",      color: "text-red-500",    bg: "bg-red-500/10"    },
              { icon: AlertCircle,  label: "2 decisions need context",   sub: "Missing evidence for pricing",  color: "text-amber-500",  bg: "bg-amber-500/10"  },
              { icon: Activity,     label: "Weekly review in 2 days",    sub: "Prepare your spec update",      color: "text-blue-500",   bg: "bg-blue-500/10"   },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-card">
                <div className={`p-2 rounded-lg ${item.bg} shrink-0`}>
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
