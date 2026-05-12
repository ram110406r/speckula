"use client";

import React from "react";
import {
  Lightbulb, CheckSquare, Compass, LayoutDashboard,
  TrendingUp, ArrowRight, Brain, Puzzle,
  FileText, Activity, Plus, ChevronRight,
  Sparkles, Target,
} from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { useApi } from "@/hooks/useApi";
import { useExtensionPreferences } from "@/hooks/useExtensionPreferences";

// ─── types ────────────────────────────────────────────────────────────────────

interface WorkspaceDashboard {
  totalSignals: number;
  extensionSignals: number;
  weeklyCaptures: number;
  competitorInsights: number;
  marketSignals: number;
  productBrainTotal: number;
  aiJobsCompleted: number;
  aiJobsFailed: number;
  topDomains: { domain: string; count: number }[];
  extension: {
    connected: boolean;
    version?: string;
    browser?: string;
    lastSeenAt?: string;
  };
  realtimeConnections: number;
  recentActivity: { id: string; type: string; description: string; createdAt: string }[];
}

interface ActivityItem {
  id: string;
  actorId: string;
  eventType: string;
  title: string;
  description?: string;
  createdAt: string;
}

// ─── static config ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: Lightbulb,       label: "Add Signal",    view: "market-intelligence" as const, color: "text-amber-500",  bg: "bg-amber-500/10"  },
  { icon: Compass,         label: "Make Decision", view: "decisions"           as const, color: "text-blue-500",   bg: "bg-blue-500/10"   },
  { icon: LayoutDashboard, label: "Write Spec",    view: "specifications"      as const, color: "text-green-500",  bg: "bg-green-500/10"  },
  { icon: CheckSquare,     label: "Create Task",   view: "tasks"               as const, color: "text-purple-500", bg: "bg-purple-500/10" },
];

// Brain health phases mapped to real dashboard fields with soft targets for progress bars.
const PHASE_CONFIG = [
  { phase: "Signals",      color: "bg-amber-500",  icon: Lightbulb,       field: "weeklyCaptures"    as const, target: 15 },
  { phase: "Competitors",  color: "bg-blue-500",   icon: TrendingUp,      field: "competitorInsights" as const, target: 10 },
  { phase: "AI Analyses",  color: "bg-green-500",  icon: LayoutDashboard, field: "aiJobsCompleted"   as const, target: 20 },
  { phase: "Brain entries",color: "bg-purple-500", icon: Brain,           field: "productBrainTotal" as const, target: 30 },
];

const AVATAR_COLORS = ["bg-pink-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500"];

// ─── helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function eventIcon(type: string): { icon: React.ElementType; color: string } {
  if (type.includes("signal") || type.includes("market")) return { icon: TrendingUp,      color: "text-amber-500"  };
  if (type.includes("decision"))                           return { icon: Compass,         color: "text-blue-500"   };
  if (type.includes("spec") || type.includes("analysis")) return { icon: LayoutDashboard, color: "text-green-500"  };
  if (type.includes("task") || type.includes("agent"))    return { icon: CheckSquare,     color: "text-purple-500" };
  return { icon: Activity, color: "text-muted-foreground" };
}

function avatarColor(actorId: string): string {
  let h = 0;
  for (let i = 0; i < actorId.length; i++) h = (h * 31 + actorId.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

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
  const { preferences } = useExtensionPreferences();
  const workspaceId = preferences?.activeWorkspaceId;

  const { data: dash } = useApi<WorkspaceDashboard>(
    `/api/workspaces/${workspaceId ?? ''}/dashboard`,
    { enabled: !!workspaceId, refreshInterval: 30_000 }
  );

  const { data: activityData } = useApi<{ items: ActivityItem[] }>(
    `/api/workspaces/${workspaceId ?? ''}/activity?limit=4`,
    { enabled: !!workspaceId, refreshInterval: 30_000 }
  );

  const activityItems = activityData?.items ?? [];
  const extensionConnected = dash?.extension?.connected ?? false;

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
          <StatCard label="Active analyses"    value={documents.length || 0}           icon={FileText}    trend="up"      />
          <StatCard label="Signals this week"  value={dash?.weeklyCaptures ?? "—"}      icon={Lightbulb}   trend="up"  sub="new captures" />
          <StatCard label="Competitor insights" value={dash?.competitorInsights ?? "—"} icon={TrendingUp}  trend="neutral" />
          <StatCard label="Brain entries"       value={dash?.productBrainTotal ?? "—"}  icon={Brain}       trend="up"      />
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
                {dash?.recentActivity?.length ? (
                  dash.recentActivity.slice(0, 4).map((item) => {
                    const { icon: Icon, color } = eventIcon(item.type);
                    return (
                      <div
                        key={item.id}
                        className="group flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card hover:border-border/70 hover:bg-muted/30 transition-all cursor-pointer"
                      >
                        <div className="p-1.5 rounded-md bg-muted shrink-0">
                          <Icon className={`h-3.5 w-3.5 ${color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{item.description}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.type} · {relativeTime(item.createdAt)}</p>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-xs text-muted-foreground border border-border/40 rounded-lg bg-card">
                    No recent activity. Start capturing signals to see intelligence here.
                  </div>
                )}
              </div>
            </div>

            {/* Product Brain health */}
            <div>
              <SectionHeader title="Product Brain Coverage" />
              <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-foreground">Data coverage by category</span>
                  <span className="ml-auto text-[10px] text-primary font-mono">{dash?.productBrainTotal ?? 0} entries</span>
                </div>
                {PHASE_CONFIG.map((ph) => {
                  const count = (dash?.[ph.field] as number | undefined) ?? 0;
                  const completeness = Math.min(100, Math.round((count / ph.target) * 100));
                  return (
                    <div key={ph.phase} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <ph.icon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{ph.phase}</span>
                          <span className="text-muted-foreground/50">({count})</span>
                        </div>
                        <span className="font-mono text-muted-foreground">{completeness}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${ph.color} transition-all`}
                          style={{ width: `${completeness}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right column (2/5) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Team activity */}
            <div>
              <SectionHeader title="Team Activity" action="All activity" onAction={() => setActiveView("activity")} />
              <div className="space-y-1">
                {activityItems.length > 0 ? (
                  activityItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className={`w-6 h-6 rounded-full ${avatarColor(item.actorId)} flex items-center justify-center shrink-0 mt-0.5`}>
                        <span className="text-[9px] font-bold text-white">{item.actorId.slice(0, 2).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-foreground leading-snug">
                          <span className="font-medium">{item.eventType}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{item.title}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">{relativeTime(item.createdAt)}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No team activity yet.
                  </div>
                )}
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
              {extensionConnected && dash?.extension ? (
                <div className="space-y-1.5 text-[11px] text-muted-foreground">
                  {dash.extension.lastSeenAt && (
                    <div className="flex justify-between"><span>Last seen</span><span className="text-foreground">{relativeTime(dash.extension.lastSeenAt)}</span></div>
                  )}
                  {dash.extension.version && (
                    <div className="flex justify-between"><span>Version</span><span className="text-foreground">{dash.extension.version}</span></div>
                  )}
                  {dash.extension.browser && (
                    <div className="flex justify-between"><span>Browser</span><span className="text-foreground">{dash.extension.browser}</span></div>
                  )}
                  <div className="flex justify-between"><span>Captures via extension</span><span className="text-foreground">{dash.extensionSignals}</span></div>
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
                {dash?.competitorInsights
                  ? `You have ${dash.competitorInsights} competitor insights captured. Review them to inform your next product decision.`
                  : "Start capturing signals and making decisions to get AI-powered suggestions."}
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

        {/* ── Focus Today ── */}
        <div>
          <SectionHeader title="Focus Today" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { icon: Target,      label: `${dash?.weeklyCaptures ?? 0} signals this week`,        sub: "View market intelligence",      color: "text-amber-500",  bg: "bg-amber-500/10",  action: "market-intelligence" },
              { icon: TrendingUp,  label: `${dash?.competitorInsights ?? 0} competitor insights`,  sub: "Stay ahead of the competition", color: "text-blue-500",   bg: "bg-blue-500/10",   action: "competitors"         },
              { icon: Brain,       label: `${dash?.productBrainTotal ?? 0} brain entries`,         sub: "Explore your product knowledge", color: "text-purple-500", bg: "bg-purple-500/10", action: "product-brain"       },
            ] as const).map((item) => (
              <div
                key={item.label}
                onClick={() => setActiveView(item.action as Parameters<typeof setActiveView>[0])}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-card cursor-pointer hover:bg-muted/30 transition-colors"
              >
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
