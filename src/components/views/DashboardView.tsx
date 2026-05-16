"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Cpu,
  Users,
  Zap,
  BarChart2,
  Target,
  Brain,
  Search,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  Shield,
  Wifi,
  WifiOff,
  Puzzle,
} from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { useSpecklaBus } from "@/hooks/useSpecklaBus";
import { useAgents, useAgentJobs, type AgentJob } from "@/hooks/useAgents";
import { useMarketSignals, type MarketSignalData } from "@/hooks/useMarketSignals";
import { useCompetitors, type CompetitorSummary } from "@/hooks/useCompetitors";
import { useExperiments, type ExperimentSummary } from "@/hooks/useExperiments";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CategoryKey =
  | "competitor"
  | "market"
  | "ai"
  | "trend"
  | "capture"
  | "decision"
  | "experiment"
  | "agent";

interface FeedItem {
  id: number;
  icon: React.ElementType;
  description: string;
  timeAgo: string;
  category: CategoryKey;
  isNew?: boolean;
}

interface Analysis {
  id: number;
  title: string;
  progress: number;
  startedAgo: string;
  color: string;
}

interface MarketSignal {
  id: number;
  label: string;
  change: number;
  up: boolean;
}

interface Decision {
  id: number;
  title: string;
  score: number;
  priority: "Critical" | "High" | "Medium" | "Low";
  ago: string;
}

interface Competitor {
  id: number;
  name: string;
  initial: string;
  color: string;
  updatedAgo: string;
  stale: boolean;
}


// ---------------------------------------------------------------------------
// Category badge config
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<
  CategoryKey,
  { dot: string; text: string; label: string }
> = {
  competitor: { dot: "bg-blue-500", text: "text-blue-400", label: "competitor" },
  market: { dot: "bg-purple-500", text: "text-purple-400", label: "market" },
  ai: { dot: "bg-emerald-500", text: "text-emerald-400", label: "ai" },
  trend: { dot: "bg-amber-500", text: "text-amber-400", label: "trend" },
  capture: { dot: "bg-cyan-500", text: "text-cyan-400", label: "capture" },
  decision: { dot: "bg-violet-500", text: "text-violet-400", label: "decision" },
  experiment: { dot: "bg-orange-500", text: "text-orange-400", label: "experiment" },
  agent: { dot: "bg-teal-500", text: "text-teal-400", label: "agent" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map an event type string to a category key for the feed. */
function eventTypeToCategory(type: string): CategoryKey {
  if (type.startsWith("analysis")) return "ai";
  if (type.startsWith("insight")) return "capture";
  if (type.startsWith("notification")) return "agent";
  if (type.startsWith("extension")) return "capture";
  return "ai";
}

/** Map an event type to a lucide icon component. */
function eventTypeToIcon(type: string): React.ElementType {
  if (type === "analysis.completed") return Brain;
  if (type === "analysis.progress") return Cpu;
  if (type === "insight.created") return Zap;
  if (type === "notification.created") return Radio;
  if (type.startsWith("extension")) return Layers;
  return Activity;
}

/** Build a human-readable description from a SpeckulaEvent. */
function eventToDescription(event: { type: string; data?: Record<string, unknown> }): string {
  const data = event.data ?? {};
  switch (event.type) {
    case "analysis.completed":
      return `AI analysis complete — ${(data.entriesCreated as number) ?? 0} entries created`;
    case "analysis.progress":
      return `Analysis in progress: ${(data.stage as string) ?? "processing"} (${(data.progress as number) ?? 0}%)`;
    case "insight.created":
      return `New insight created: ${(data.entryType as string) ?? "entry"}`;
    case "notification.created":
      return (data.title as string) ?? "New notification";
    case "extension.connected":
      return "Browser extension connected";
    case "extension.disconnected":
      return "Browser extension disconnected";
    default:
      return `Event: ${event.type}`;
  }
}

// ---------------------------------------------------------------------------
// Real-data mapping helpers
// ---------------------------------------------------------------------------

const COMPETITOR_COLORS = [
  "bg-zinc-700", "bg-indigo-700", "bg-violet-700", "bg-rose-700", "bg-blue-800",
  "bg-teal-700", "bg-amber-700",
];

function competitorColor(domain: string): string {
  let h = 0;
  for (let i = 0; i < domain.length; i++) h = (h * 31 + domain.charCodeAt(i)) & 0xffff;
  return COMPETITOR_COLORS[h % COMPETITOR_COLORS.length];
}

function mapCompetitor(c: CompetitorSummary, idx: number): Competitor {
  const staleMs = 2 * 24 * 60 * 60 * 1000;
  const capturedTs = c.lastCapturedAt ? new Date(c.lastCapturedAt).getTime() : 0;
  const stale = capturedTs === 0 || Date.now() - capturedTs > staleMs;
  const diff = capturedTs ? Date.now() - capturedTs : 0;
  const updatedAgo = capturedTs === 0 ? "–" :
    diff < 3_600_000 ? `${Math.floor(diff / 60_000)}m ago` :
    diff < 86_400_000 ? `${Math.floor(diff / 3_600_000)}h ago` :
    `${Math.floor(diff / 86_400_000)}d ago`;
  return {
    id: idx + 1,
    name: c.competitorName || c.domain,
    initial: (c.competitorName || c.domain).charAt(0).toUpperCase(),
    color: competitorColor(c.domain),
    updatedAgo,
    stale,
  };
}

function mapJob(job: AgentJob, idx: number): Analysis {
  const COLORS = ["bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500"];
  const diff = Date.now() - new Date(job.createdAt).getTime();
  const startedAgo =
    diff < 60_000 ? "just now" :
    diff < 3_600_000 ? `${Math.floor(diff / 60_000)}m ago` :
    `${Math.floor(diff / 3_600_000)}h ago`;
  let urlHost = "";
  try { if (job.sourceUrl) urlHost = new URL(job.sourceUrl).hostname; } catch { urlHost = job.sourceUrl ?? ""; }
  return {
    id: idx + 1,
    title: urlHost
      ? `${job.pageType ?? "Analysis"} — ${urlHost}`
      : `${job.pageType ?? "Analysis"} job`,
    progress: job.progress ?? (job.status === "completed" ? 100 : 20),
    startedAgo,
    color: COLORS[idx % COLORS.length],
  };
}

function mapSignal(s: MarketSignalData, idx: number): MarketSignal {
  return {
    id: idx + 1,
    label: s.title,
    change: Math.round(s.strength * 100),
    up: true,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LiveBadge() {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      LIVE
    </span>
  );
}

function PulseDot({ color = "bg-emerald-500" }: { color?: string }) {
  return <span className={`h-2 w-2 rounded-full ${color} animate-pulse`} />;
}

function CategoryBadge({ category }: { category: CategoryKey }) {
  const cfg = CATEGORY_CONFIG[category];
  return (
    <span className={`flex items-center gap-1 text-[10px] font-medium ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function TopMetricCard({
  label,
  value,
  trend,
  trendLabel,
  live = false,
  liveColor = "bg-emerald-500",
  loading = false,
}: {
  label: string;
  value: string;
  trend?: string;
  trendLabel?: string;
  live?: boolean;
  liveColor?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg sm:rounded-xl p-3 sm:p-4 flex flex-col gap-2 min-w-0 animate-pulse">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-7 w-16 rounded bg-muted" />
        <div className="h-3 w-20 rounded bg-muted" />
      </div>
    );
  }
  return (
    <div className="bg-card border border-border rounded-lg sm:rounded-xl p-3 sm:p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
          {label}
        </span>
        {live && <PulseDot color={liveColor} />}
      </div>
      <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-none">
        {value}
      </span>
      {(trend || trendLabel) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {trend && (
            <span className="text-xs sm:text-sm font-medium text-emerald-500 flex items-center gap-0.5 shrink-0">
              <ArrowUpRight className="h-3 w-3" />
              {trend}
            </span>
          )}
          {trendLabel && (
            <span className="text-xs sm:text-sm text-muted-foreground">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  badge,
}: {
  title: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
      {badge}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Decision["priority"] }) {
  const map: Record<Decision["priority"], string> = {
    Critical: "text-red-400 bg-red-500/10 border-red-500/20",
    High: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    Medium: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    Low: "text-muted-foreground bg-muted border-border",
  };
  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${map[priority]}`}
    >
      {priority}
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 90
      ? "text-emerald-400"
      : score >= 75
      ? "text-amber-400"
      : "text-muted-foreground";
  return (
    <span className={`text-[22px] font-bold tabular-nums ${color}`}>{score}</span>
  );
}

/** Small WebSocket connection status badge shown in the page header. */
function WsStatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`flex items-center gap-1.5 text-[11px] font-medium ${
        connected ? "text-emerald-500" : "text-muted-foreground"
      }`}
    >
      {connected ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      {connected ? "Live" : "Offline"}
    </span>
  );
}

/** Banner shown when the browser extension is connected. */
function ExtensionBanner({
  version,
  browser,
}: {
  version?: string;
  browser?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[11px] text-emerald-400">
      <Puzzle className="h-3 w-3 shrink-0" />
      <span>
        Extension connected
        {version ? ` · v${version}` : ""}
        {browser ? ` · ${browser}` : ""}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DashboardView() {
  // ── Real data ────────────────────────────────────────────────────────────
  const { data: overview, loading } = useDashboard();
  const { connected, lastEvent } = useSpecklaBus();
  const { data: agentsData } = useAgents();
  const { data: jobsData } = useAgentJobs();
  const { data: signalsData } = useMarketSignals();
  const { data: competitorsData } = useCompetitors();
  const { data: experimentsData } = useExperiments();

  // ── Local state ──────────────────────────────────────────────────────────
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live WebSocket events prepended to the feed (max 5 live items shown)
  const [liveItems, setLiveItems] = useState<FeedItem[]>([]);
  const liveIdRef = useRef(-1); // negative IDs to avoid collisions with API data IDs

  // ── Rotate highlighted row in the feed ───────────────────────────────────
  const feedItems: FeedItem[] = [
    ...liveItems,
    ...(overview?.recentActivity
      ? overview.recentActivity.map(
          (
            a: {
              id?: unknown;
              type?: string;
              description?: string;
              createdAt?: string;
              category?: string;
            },
            idx: number
          ): FeedItem => ({
            id: typeof a.id === "number" ? a.id : idx + 1000,
            icon: eventTypeToIcon(a.type ?? ""),
            description: a.description ?? eventToDescription({ type: a.type ?? "", data: {} }),
            timeAgo: a.createdAt
              ? new Date(a.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "just now",
            category: (a.category as CategoryKey | undefined) ?? eventTypeToCategory(a.type ?? ""),
          })
        )
      : []),
  ];

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setHighlightedIndex((prev) => (prev + 1) % feedItems.length);
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedItems.length]);

  // ── Inject live WebSocket events into the feed ───────────────────────────
  useEffect(() => {
    if (!lastEvent) return;
    const relevantTypes = ["analysis.completed", "insight.created", "notification.created"];
    if (!relevantTypes.includes(lastEvent.type)) return;

    const newItem: FeedItem = {
      id: liveIdRef.current--,
      icon: eventTypeToIcon(lastEvent.type),
      description: eventToDescription({
        type: lastEvent.type,
        data: ("data" in lastEvent ? lastEvent.data : {}) as Record<string, unknown>,
      }),
      timeAgo: "just now",
      category: eventTypeToCategory(lastEvent.type),
      isNew: true,
    };

    setLiveItems((prev) => [newItem, ...prev].slice(0, 5));
  }, [lastEvent]);

  // ── Derive metrics from real data (show "—" when unavailable) ────────────
  const isMetricsLoading = loading && overview === null;

  const metrics = {
    totalSignals: overview?.totalSignals != null ? String(overview.totalSignals) : "—",
    weeklyCaptures: overview?.weeklyCaptures != null ? String(overview.weeklyCaptures) : "—",
    aiJobsRunning: overview?.realtimeConnections != null ? String(overview.realtimeConnections) : "—",
    competitorDomains: overview?.competitorInsights != null ? String(overview.competitorInsights) : "—",
    activeAgents: agentsData?.summary.running != null ? String(agentsData.summary.running) : "—",
  };

  // ── Real data arrays ───────────────────────────────────────────────────────
  const activeJobs = (jobsData?.jobs ?? [])
    .filter((j) => j.status === "queued" || j.status === "processing")
    .slice(0, 3);
  const analyses: Analysis[] = activeJobs.map(mapJob);

  const marketSignals: MarketSignal[] = signalsData?.signals?.length
    ? signalsData.signals.slice(0, 5).map(mapSignal)
    : [];

  const competitors: Competitor[] = competitorsData?.competitors?.length
    ? competitorsData.competitors.slice(0, 5).map(mapCompetitor)
    : [];

  // ── Extension status ──────────────────────────────────────────────────────
  const extensionConnected = overview?.extension?.connected === true;
  const extensionVersion = overview?.extension?.version as string | undefined;
  const extensionBrowser = overview?.extension?.browser as string | undefined;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5 lg:space-y-6">

        {/* ----------------------------------------------------------------- */}
        {/* Page header                                                        */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-foreground leading-tight">
                Command Center
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Startup operating intelligence
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <WsStatusBadge connected={connected} />
            <LiveBadge />
          </div>
        </div>

        {/* Extension connected banner (only when real extension is active) */}
        {extensionConnected && (
          <ExtensionBanner version={extensionVersion} browser={extensionBrowser} />
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Top metrics row (5 cards) - Responsive grid                        */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-3">
          <TopMetricCard
            label="Signals Captured"
            value={metrics.totalSignals}
            trend="↑12%"
            trendLabel="this week"
            loading={isMetricsLoading}
          />
          <TopMetricCard
            label="Market Trends"
            value={metrics.weeklyCaptures}
            trend="↑5 new"
            trendLabel="today"
            loading={isMetricsLoading}
          />
          <TopMetricCard
            label="AI Analyses Running"
            value={metrics.aiJobsRunning}
            live
            liveColor="bg-blue-500"
            loading={isMetricsLoading}
          />
          <TopMetricCard
            label="Competitors Tracked"
            value={metrics.competitorDomains}
            trend="↑1 new"
            loading={isMetricsLoading}
          />
          <TopMetricCard
            label="Active Agents"
            value={metrics.activeAgents}
            live
            liveColor="bg-emerald-500"
            loading={isMetricsLoading}
          />
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Main 2-column grid - Responsive stacking on mobile                 */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 sm:gap-5 lg:gap-6 items-start">

          {/* =============================================================== */}
          {/* LEFT COLUMN                                                      */}
          {/* =============================================================== */}
          <div className="space-y-4 sm:space-y-5 lg:space-y-6">

            {/* Live Intelligence Feed */}
            <div className="bg-card border border-border rounded-lg sm:rounded-xl overflow-hidden">
              <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border flex items-center justify-between gap-2">
                <SectionHeader title="Live Intelligence Feed" />
                <LiveBadge />
              </div>
              <ul>
                {feedItems.map((item, idx) => {
                  const Icon = item.icon;
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <li
                      key={item.id}
                      className={`flex items-start gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-border/50 last:border-0 transition-colors duration-500 ${
                        isHighlighted
                          ? "bg-primary/5"
                          : "hover:bg-muted/40"
                      } ${item.isNew ? "ring-1 ring-inset ring-emerald-500/20" : ""}`}
                    >
                      <div className="mt-0.5 h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base text-foreground leading-snug">
                          {item.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 shrink-0">
                            <Clock className="h-2.5 w-2.5" />
                            {item.timeAgo}
                          </span>
                          <CategoryBadge category={item.category} />
                          {item.isNew && (
                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
                              new
                            </span>
                          )}
                        </div>
                      </div>
                      {isHighlighted && (
                        <span className="shrink-0 mt-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse block" />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Active AI Analyses */}
            <div>
              <SectionHeader
                title="Active AI Analyses"
                badge={
                  <span className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-blue-400 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                    {analyses.length} running
                  </span>
                }
              />
              <div className="space-y-3 sm:space-y-4">
                {analyses.length === 0 && (
                  <div className="bg-card border border-dashed border-border rounded-lg sm:rounded-xl p-4 sm:p-5 flex items-center justify-center min-h-20">
                    <span className="text-xs sm:text-sm text-muted-foreground">No active analyses</span>
                  </div>
                )}
                {analyses.map((analysis) => (
                  <div
                    key={analysis.id}
                    className="bg-card border border-border rounded-lg sm:rounded-xl p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="text-sm sm:text-base font-medium text-foreground leading-snug flex-1 min-w-0">
                        {analysis.title}
                      </p>
                      <span className="shrink-0 text-xs sm:text-sm font-bold text-foreground tabular-nums">
                        {analysis.progress}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${analysis.color} transition-all duration-1000`}
                        style={{ width: `${analysis.progress}%` }}
                      />
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5 shrink-0" />
                      Started {analysis.startedAgo}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* RIGHT COLUMN                                                     */}
          {/* =============================================================== */}
          <div className="space-y-4 sm:space-y-5 lg:space-y-6">

            {/* Market Signals */}
            <div className="bg-card border border-border rounded-lg sm:rounded-xl overflow-hidden">
              <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border">
                <span className="text-sm sm:text-base font-semibold text-foreground">
                  Market Signals
                </span>
              </div>
              {marketSignals.length === 0 && (
                <div className="flex items-center justify-center min-h-16 px-4">
                  <span className="text-xs sm:text-sm text-muted-foreground">No market signals yet</span>
                </div>
              )}
              <ul>
                {marketSignals.map((signal) => (
                  <li
                    key={signal.id}
                    className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs sm:text-sm text-foreground truncate">
                        {signal.label}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 flex items-center gap-0.5 text-xs sm:text-sm font-semibold tabular-nums ${
                        signal.up ? "text-emerald-500" : "text-red-400"
                      }`}
                    >
                      {signal.up ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {signal.change}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recent Decisions */}
            <div>
              <SectionHeader title="Recent Decisions" />
              <div className="space-y-2.5 sm:space-y-3">
                {!experimentsData?.experiments?.length && (
                  <div className="bg-card border border-dashed border-border rounded-lg sm:rounded-xl p-4 sm:p-5 flex items-center justify-center min-h-20">
                    <span className="text-xs sm:text-sm text-muted-foreground">No recent decisions</span>
                  </div>
                )}
                {(experimentsData?.experiments ?? [])
                  .slice(0, 3)
                  .map((exp: ExperimentSummary) => {
                    const score = exp.verdict === 'winner_found' ? 92 : exp.verdict === 'inconclusive' ? 65 : 78;
                    const priority: Decision['priority'] =
                      exp.verdict === 'winner_found' ? 'Critical' : exp.verdict === 'inconclusive' ? 'Low' : 'High';
                    return (
                      <div
                        key={exp.id}
                        className="bg-card border border-border rounded-lg sm:rounded-xl p-4 sm:p-5 flex items-start gap-3"
                      >
                        <ScoreRing score={score} />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <p className="text-sm sm:text-base font-medium text-foreground leading-snug">
                            {exp.title}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <PriorityBadge priority={priority} />
                            <span className="text-xs text-muted-foreground">
                              {exp.startedAt
                                ? `${Math.floor((Date.now() - new Date(exp.startedAt).getTime()) / 86_400_000)}d ago`
                                : `${Math.floor((Date.now() - new Date(exp.createdAt).getTime()) / 3_600_000)}h ago`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Monitored Competitors */}
            <div className="bg-card border border-border rounded-lg sm:rounded-xl overflow-hidden">
              <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border flex items-center justify-between gap-2">
                <span className="text-sm sm:text-base font-semibold text-foreground">
                  Monitored Competitors
                </span>
                <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
              {competitors.length === 0 && (
                <div className="flex items-center justify-center min-h-16 px-4">
                  <span className="text-xs sm:text-sm text-muted-foreground">No competitors tracked yet</span>
                </div>
              )}
              <ul>
                {competitors.map((comp) => (
                  <li
                    key={comp.id}
                    className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {/* Favicon placeholder */}
                    <div
                      className={`h-6 w-6 rounded-md ${comp.color} flex items-center justify-center shrink-0`}
                    >
                      <span className="text-[10px] font-bold text-white">
                        {comp.initial}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-foreground">
                        {comp.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Updated {comp.updatedAgo}
                      </p>
                    </div>
                    {/* Status dot */}
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        comp.stale
                          ? "bg-amber-500/60"
                          : "bg-emerald-500 animate-pulse"
                      }`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Bottom startup metrics bar - Responsive grid                       */}
        {/* ----------------------------------------------------------------- */}
        <div className="bg-card border border-border rounded-lg sm:rounded-xl p-4 sm:p-5 lg:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-5">
            <BarChart2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Intelligence Metrics
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
            {/* Total Signals */}
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground tabular-nums leading-none">
                  {overview?.totalSignals ?? '—'}
                </span>
                <span className="text-xs sm:text-sm font-medium text-emerald-500 flex items-center gap-0.5 shrink-0">
                  <ArrowUpRight className="h-2.5 w-2.5" />
                  {overview?.totalSignals ? '↑' : ''}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">Signals Captured</p>
            </div>
            {/* Weekly Captures */}
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground tabular-nums leading-none">
                  {overview?.weeklyCaptures ?? '—'}
                </span>
                <span className="text-xs sm:text-sm font-medium text-emerald-500 flex items-center gap-0.5 shrink-0">
                  <ArrowUpRight className="h-2.5 w-2.5" />
                  new
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">This Week</p>
            </div>
            {/* Competitor Insights */}
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground tabular-nums leading-none">
                  {overview?.competitorInsights ?? '—'}
                </span>
                <span className="text-xs sm:text-sm font-medium text-emerald-500 flex items-center gap-0.5 shrink-0">
                  <ArrowUpRight className="h-2.5 w-2.5" />
                  {overview?.competitorInsights ? 'tracked' : ''}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">Competitors</p>
            </div>
            {/* AI Jobs */}
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground tabular-nums leading-none">
                  {overview?.aiJobsCompleted ?? '—'}
                </span>
                <PulseDot color="bg-blue-500" />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">AI Jobs Run</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
