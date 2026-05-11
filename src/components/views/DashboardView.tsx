"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Cpu,
  Users,
  Zap,
  Globe,
  BarChart2,
  Target,
  Brain,
  Search,
  MessageSquare,
  Layers,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  Shield,
} from "lucide-react";

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
// Static mock data
// ---------------------------------------------------------------------------

const FEED_ITEMS: FeedItem[] = [
  {
    id: 1,
    icon: Globe,
    description: "Notion raised prices on Business plan by 15%",
    timeAgo: "2m ago",
    category: "competitor",
  },
  {
    id: 2,
    icon: MessageSquare,
    description: "Reddit: 47 complaints about Linear's new pricing",
    timeAgo: "8m ago",
    category: "market",
  },
  {
    id: 3,
    icon: Brain,
    description: "AI analysis complete: Figma competitor positioning",
    timeAgo: "12m ago",
    category: "ai",
  },
  {
    id: 4,
    icon: TrendingUp,
    description: "New trend detected: 'AI project management' +340% search volume",
    timeAgo: "23m ago",
    category: "trend",
  },
  {
    id: 5,
    icon: Layers,
    description: "Extension captured: productboard.com pricing page",
    timeAgo: "31m ago",
    category: "capture",
  },
  {
    id: 6,
    icon: Target,
    description: "Decision scored: Launch freemium tier — 87/100",
    timeAgo: "45m ago",
    category: "decision",
  },
  {
    id: 7,
    icon: Zap,
    description: "Competitor update: Linear shipped timeline view",
    timeAgo: "1h ago",
    category: "competitor",
  },
  {
    id: 8,
    icon: Users,
    description: "Market signal: 23 YC founders discussing PM tools on Twitter",
    timeAgo: "1h ago",
    category: "market",
  },
  {
    id: 9,
    icon: Radio,
    description: "Agent: Weekly digest compiled — 3 high-priority insights",
    timeAgo: "2h ago",
    category: "agent",
  },
  {
    id: 10,
    icon: FlaskConical,
    description: "Experiment result: Onboarding A/B test — Variant B +23% activation",
    timeAgo: "3h ago",
    category: "experiment",
  },
];

const ANALYSES: Analysis[] = [
  {
    id: 1,
    title: "Competitor Positioning Analysis — Figma vs Speckula",
    progress: 67,
    startedAgo: "8m ago",
    color: "bg-blue-500",
  },
  {
    id: 2,
    title: "Reddit Sentiment Scan — PM Tools subreddit",
    progress: 34,
    startedAgo: "23m ago",
    color: "bg-purple-500",
  },
  {
    id: 3,
    title: "Market trend synthesis — Q2 2026 signals",
    progress: 89,
    startedAgo: "2m ago",
    color: "bg-emerald-500",
  },
];

const MARKET_SIGNALS: MarketSignal[] = [
  { id: 1, label: "AI-native tools adoption", change: 340, up: true },
  { id: 2, label: "PM tool switching intent", change: 127, up: true },
  { id: 3, label: '"Notion alternative" searches', change: 89, up: true },
  { id: 4, label: "Linear enterprise churn", change: 34, up: true },
  { id: 5, label: "Startup OS category", change: 512, up: true },
];

const DECISIONS: Decision[] = [
  {
    id: 1,
    title: "Launch freemium tier",
    score: 87,
    priority: "High",
    ago: "2 days ago",
  },
  {
    id: 2,
    title: "Ship browser extension v2",
    score: 91,
    priority: "Critical",
    ago: "1 day ago",
  },
  {
    id: 3,
    title: "Expand competitor monitoring",
    score: 74,
    priority: "Medium",
    ago: "3 days ago",
  },
];

const COMPETITORS: Competitor[] = [
  { id: 1, name: "Notion", initial: "N", color: "bg-zinc-700", updatedAgo: "2h ago", stale: false },
  { id: 2, name: "Linear", initial: "L", color: "bg-indigo-700", updatedAgo: "5h ago", stale: false },
  { id: 3, name: "Productboard", initial: "P", color: "bg-violet-700", updatedAgo: "1d ago", stale: false },
  { id: 4, name: "Figma", initial: "F", color: "bg-rose-700", updatedAgo: "3h ago", stale: false },
  { id: 5, name: "Jira", initial: "J", color: "bg-blue-800", updatedAgo: "2d ago", stale: true },
];

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
}: {
  label: string;
  value: string;
  trend?: string;
  trendLabel?: string;
  live?: boolean;
  liveColor?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground truncate">
          {label}
        </span>
        {live && <PulseDot color={liveColor} />}
      </div>
      <span className="text-2xl font-bold tracking-tight text-foreground leading-none">
        {value}
      </span>
      {(trend || trendLabel) && (
        <div className="flex items-center gap-1.5">
          {trend && (
            <span className="text-[11px] font-medium text-emerald-500 flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3" />
              {trend}
            </span>
          )}
          {trendLabel && (
            <span className="text-[11px] text-muted-foreground">{trendLabel}</span>
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DashboardView() {
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setHighlightedIndex((prev) => (prev + 1) % FEED_ITEMS.length);
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-[1280px] mx-auto px-5 py-6 space-y-5">

        {/* ----------------------------------------------------------------- */}
        {/* Page header                                                        */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-foreground leading-tight">
                Command Center
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Startup operating intelligence
              </p>
            </div>
          </div>
          <LiveBadge />
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Top metrics row (5 cards)                                          */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <TopMetricCard
            label="Signals Captured"
            value="847"
            trend="↑12%"
            trendLabel="this week"
          />
          <TopMetricCard
            label="Market Trends"
            value="34"
            trend="↑5 new"
            trendLabel="today"
          />
          <TopMetricCard
            label="AI Analyses Running"
            value="12"
            live
            liveColor="bg-blue-500"
          />
          <TopMetricCard
            label="Competitors Tracked"
            value="6"
            trend="↑1 new"
          />
          <TopMetricCard
            label="Active Agents"
            value="3"
            live
            liveColor="bg-emerald-500"
          />
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Main 2-column grid                                                 */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">

          {/* =============================================================== */}
          {/* LEFT COLUMN                                                      */}
          {/* =============================================================== */}
          <div className="space-y-5">

            {/* Live Intelligence Feed */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <SectionHeader title="Live Intelligence Feed" />
                <LiveBadge />
              </div>
              <ul>
                {FEED_ITEMS.map((item, idx) => {
                  const Icon = item.icon;
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <li
                      key={item.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors duration-500 ${
                        isHighlighted
                          ? "bg-primary/5"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="mt-0.5 h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] text-foreground leading-snug">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {item.timeAgo}
                          </span>
                          <CategoryBadge category={item.category} />
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
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-blue-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                    {ANALYSES.length} running
                  </span>
                }
              />
              <div className="space-y-3">
                {ANALYSES.map((analysis) => (
                  <div
                    key={analysis.id}
                    className="bg-card border border-border rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="text-[12.5px] font-medium text-foreground leading-snug flex-1">
                        {analysis.title}
                      </p>
                      <span className="shrink-0 text-[12px] font-bold text-foreground tabular-nums">
                        {analysis.progress}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${analysis.color} transition-all duration-1000`}
                        style={{ width: `${analysis.progress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
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
          <div className="space-y-5">

            {/* Market Signals */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <span className="text-[13px] font-semibold text-foreground">
                  Market Signals
                </span>
              </div>
              <ul>
                {MARKET_SIGNALS.map((signal) => (
                  <li
                    key={signal.id}
                    className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-[12px] text-foreground truncate">
                        {signal.label}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 flex items-center gap-0.5 text-[12px] font-semibold tabular-nums ml-3 ${
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
              <div className="space-y-2.5">
                {DECISIONS.map((decision) => (
                  <div
                    key={decision.id}
                    className="bg-card border border-border rounded-xl p-4 flex items-start gap-3"
                  >
                    <ScoreRing score={decision.score} />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-[12.5px] font-medium text-foreground leading-snug">
                        {decision.title}
                      </p>
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={decision.priority} />
                        <span className="text-[10px] text-muted-foreground">
                          {decision.ago}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monitored Competitors */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-[13px] font-semibold text-foreground">
                  Monitored Competitors
                </span>
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <ul>
                {COMPETITORS.map((comp) => (
                  <li
                    key={comp.id}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
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
                      <p className="text-[12.5px] font-medium text-foreground">
                        {comp.name}
                      </p>
                      <p className="text-[10.5px] text-muted-foreground">
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
        {/* Bottom startup metrics bar                                         */}
        {/* ----------------------------------------------------------------- */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Startup Metrics
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* WAU */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-bold text-foreground tabular-nums leading-none">
                  1,247
                </span>
                <span className="text-[11px] font-medium text-emerald-500 flex items-center gap-0.5">
                  <ArrowUpRight className="h-2.5 w-2.5" />
                  18%
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Weekly Active Users</p>
            </div>
            {/* Avg session */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-bold text-foreground tabular-nums leading-none">
                  24<span className="text-[14px] font-semibold">min</span>
                </span>
                <span className="text-[11px] font-medium text-emerald-500 flex items-center gap-0.5">
                  <ArrowUpRight className="h-2.5 w-2.5" />
                  8%
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Avg Session</p>
            </div>
            {/* Extension installs */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-bold text-foreground tabular-nums leading-none">
                  892
                </span>
                <span className="text-[11px] font-medium text-emerald-500 flex items-center gap-0.5">
                  <ArrowUpRight className="h-2.5 w-2.5" />
                  31%
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Extension Installs</p>
            </div>
            {/* AI requests */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-bold text-foreground tabular-nums leading-none">
                  3,441
                </span>
                <PulseDot color="bg-blue-500" />
              </div>
              <p className="text-[11px] text-muted-foreground">AI Requests Today</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
