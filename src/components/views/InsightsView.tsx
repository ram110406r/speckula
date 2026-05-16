"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  Flame,
  AlertTriangle,
  Zap,
  Brain,
  Minus,
  MessageSquare,
  ThumbsUp,
  Activity,
  Radio,
  Target,
  BarChart2,
  ChevronRight,
  CheckCircle2,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketSignals, useMarketTrends, useMarketOpportunities, type MarketOpportunityData } from "@/hooks/useMarketSignals";
import { useSpecklaBus } from "@/hooks/useSpecklaBus";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SignalCategory = "pain_point" | "complaint" | "trend" | "opportunity" | "launch";
type Sentiment = "negative" | "positive" | "neutral";
type TrendDirection = "rising" | "viral" | "stable" | "falling";
type Urgency = "high" | "medium" | "low";
type FilterKey = "all" | "pain_point" | "trend" | "opportunity" | "complaint" | "launch";
type TrendCategory = "category_creation" | "feature_demand" | "churn_signal" | "competitor_weakness";
type OpportunityCategory = "market_gap" | "feature_demand" | "pricing_opportunity";

interface Signal {
  id: string;
  source: string;
  category: SignalCategory;
  sentiment: Sentiment;
  title: string;
  excerpt: string;
  votes: number;
  comments: number;
  timeAgo: string;
  trend: TrendDirection;
  urgency: Urgency;
}

interface Trend {
  name: string;
  growth: string;
  volume: string;
  category: TrendCategory;
  momentum: number;
}

interface Opportunity {
  title: string;
  description: string;
  strength: number;
  category: OpportunityCategory;
}


// ─────────────────────────────────────────────────────────────────────────────
// Helpers & Config
// ─────────────────────────────────────────────────────────────────────────────

const FILTER_PILLS: { id: FilterKey; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pain_point", label: "Pain Points" },
  { id: "trend", label: "Trends" },
  { id: "opportunity", label: "Opportunities" },
  { id: "complaint", label: "Complaints" },
  { id: "launch", label: "Launches" },
];

/** Format an ISO timestamp as a relative string. */
function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
}

/** Map a backend signalType to a UI SignalCategory.
 *  Backend types come from the analysis worker prompt:
 *  trend | competitor_move | market_shift | customer_feedback | pricing_change | feature_launch
 */
function mapSignalTypeToCategory(signalType: string): SignalCategory {
  const t = signalType.toLowerCase();
  // Exact backend-type matches first (most reliable).
  if (t === "customer_feedback")       return "complaint";
  if (t === "pricing_change")          return "opportunity";
  if (t === "feature_launch")          return "launch";
  if (t === "trend")                   return "trend";
  if (t === "competitor_move")         return "trend";
  if (t === "market_shift")            return "trend";
  // Substring fallbacks for any future types.
  if (t.includes("pain") || t.includes("problem"))  return "pain_point";
  if (t.includes("complaint") || t.includes("feedback") || t.includes("frustrat")) return "complaint";
  if (t.includes("opportun") || t.includes("pric"))  return "opportunity";
  if (t.includes("launch"))           return "launch";
  if (t.includes("trend") || t.includes("market") || t.includes("competitor")) return "trend";
  return "trend";
}

/** Map a backend signalType to a TrendCategory for the sidebar. */
function mapSignalTypeToTrendCategory(signalType: string): TrendCategory {
  const t = signalType.toLowerCase();
  if (t.includes("churn") || t.includes("switching")) return "churn_signal";
  if (t.includes("competitor") || t.includes("weakness")) return "competitor_weakness";
  if (t.includes("feature") || t.includes("demand")) return "feature_demand";
  return "category_creation";
}

function getSourceBadge(source: string): { bg: string; text: string; dot: string } {
  if (source.toLowerCase().includes("reddit")) {
    return { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" };
  }
  if (source.toLowerCase().includes("hackernews") || source.toLowerCase().includes("hacker")) {
    return { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" };
  }
  if (source.toLowerCase().includes("twitter") || source.toLowerCase().includes("/x")) {
    return { bg: "bg-sky-500/10", text: "text-sky-400", dot: "bg-sky-400" };
  }
  if (source.toLowerCase().includes("producthunt")) {
    return { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" };
  }
  return { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" };
}

function getCategoryBadge(category: SignalCategory): { bg: string; text: string; label: string } {
  const map: Record<SignalCategory, { bg: string; text: string; label: string }> = {
    pain_point:  { bg: "bg-red-500/10",     text: "text-red-400",     label: "Pain Point"  },
    complaint:   { bg: "bg-orange-500/10",  text: "text-orange-400",  label: "Complaint"   },
    trend:       { bg: "bg-purple-500/10",  text: "text-purple-400",  label: "Trend"       },
    opportunity: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Opportunity" },
    launch:      { bg: "bg-blue-500/10",    text: "text-blue-400",    label: "Launch"      },
  };
  return map[category];
}

function getTrendCategoryBadge(category: TrendCategory): { bg: string; text: string; label: string } {
  const map: Record<TrendCategory, { bg: string; text: string; label: string }> = {
    category_creation:   { bg: "bg-purple-500/10",  text: "text-purple-400",  label: "Category Creation"   },
    feature_demand:      { bg: "bg-blue-500/10",    text: "text-blue-400",    label: "Feature Demand"      },
    churn_signal:        { bg: "bg-red-500/10",     text: "text-red-400",     label: "Churn Signal"        },
    competitor_weakness: { bg: "bg-amber-500/10",   text: "text-amber-400",   label: "Competitor Weakness" },
  };
  return map[category];
}

function getOpportunityCategoryBadge(category: OpportunityCategory): { bg: string; text: string; label: string } {
  const map: Record<OpportunityCategory, { bg: string; text: string; label: string }> = {
    market_gap:          { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Market Gap"          },
    feature_demand:      { bg: "bg-blue-500/10",    text: "text-blue-400",    label: "Feature Demand"      },
    pricing_opportunity: { bg: "bg-amber-500/10",   text: "text-amber-400",   label: "Pricing Opportunity" },
  };
  return map[category];
}

function getMomentumColor(momentum: number): string {
  if (momentum >= 90) return "bg-red-500";
  if (momentum >= 75) return "bg-amber-500";
  if (momentum >= 60) return "bg-emerald-500";
  return "bg-muted-foreground";
}

function getStrengthColor(strength: number): string {
  if (strength >= 90) return "bg-red-500";
  if (strength >= 80) return "bg-amber-500";
  if (strength >= 70) return "bg-emerald-500";
  return "bg-blue-500";
}

function getSentimentIcon(sentiment: Sentiment): string {
  if (sentiment === "negative") return "😤";
  if (sentiment === "positive") return "🚀";
  return "🔍";
}

function formatVotes(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface TrendIconProps {
  trend: TrendDirection;
}

function TrendIcon({ trend }: TrendIconProps) {
  if (trend === "viral") {
    return <Flame className="h-3.5 w-3.5 text-red-500 animate-pulse" />;
  }
  if (trend === "rising") {
    return <TrendingUp className="h-3.5 w-3.5 text-amber-400" />;
  }
  if (trend === "falling") {
    return <TrendingDown className="h-3.5 w-3.5 text-blue-400" />;
  }
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function getTrendLabel(trend: TrendDirection): string {
  const map: Record<TrendDirection, string> = {
    viral: "Viral",
    rising: "Rising",
    stable: "Stable",
    falling: "Falling",
  };
  return map[trend];
}

interface UrgencyDotProps {
  urgency: Urgency;
}

function UrgencyDot({ urgency }: UrgencyDotProps) {
  if (urgency === "high") {
    return (
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
      </span>
    );
  }
  if (urgency === "medium") {
    return <span className="inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />;
  }
  return <span className="inline-flex rounded-full h-2.5 w-2.5 bg-muted-foreground/40" />;
}

interface SignalCardProps {
  signal: Signal;
  onAddToBrain: (id: string) => void;
  addedIds: Set<string>;
}

function SignalCard({ signal, onAddToBrain, addedIds }: SignalCardProps) {
  const sourceBadge = getSourceBadge(signal.source);
  const categoryBadge = getCategoryBadge(signal.category);
  const isAdded = addedIds.has(signal.id);

  return (
    <div className="group relative flex flex-col gap-3 p-4 rounded-xl border border-border bg-card hover:border-border/80 hover:shadow-sm transition-all duration-200">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Source badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${sourceBadge.bg} ${sourceBadge.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${sourceBadge.dot}`} />
            {signal.source}
          </span>
          {/* Category badge */}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${categoryBadge.bg} ${categoryBadge.text}`}
          >
            {categoryBadge.label}
          </span>
        </div>
        {/* Time + urgency */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground font-mono">{signal.timeAgo}</span>
          <UrgencyDot urgency={signal.urgency} />
        </div>
      </div>

      {/* Sentiment + title */}
      <div className="flex items-start gap-2">
        <span className="text-base leading-none mt-0.5 shrink-0">{getSentimentIcon(signal.sentiment)}</span>
        <h3 className="text-[13px] font-semibold leading-snug text-foreground line-clamp-2">{signal.title}</h3>
      </div>

      {/* Excerpt */}
      <p className="text-[12px] leading-relaxed text-muted-foreground line-clamp-3">{signal.excerpt}</p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1 gap-2">
        {/* Stats */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
            <ThumbsUp className="h-3 w-3" />
            {formatVotes(signal.votes)}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
            <MessageSquare className="h-3 w-3" />
            {signal.comments}
          </span>
          {/* Trend */}
          <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
            <TrendIcon trend={signal.trend} />
            {getTrendLabel(signal.trend)}
          </span>
        </div>

        {/* Add to Brain */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAddToBrain(signal.id)}
          disabled={isAdded}
          className={`h-6 px-2 text-[10px] font-mono transition-all duration-300 ${
            isAdded
              ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10 cursor-default"
              : "hover:border-primary/60 hover:text-primary hover:bg-primary/5"
          }`}
        >
          {isAdded ? (
            <>
              <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Added
            </>
          ) : (
            <>
              <Brain className="h-2.5 w-2.5 mr-1" /> Add to Brain
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent: string;
}

function MetricCard({ label, value, sub, icon, accent }: MetricCardProps) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className={`p-1.5 rounded-lg ${accent}`}>{icon}</span>
      </div>
      <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
      <span className="text-[11px] text-muted-foreground font-mono">{sub}</span>
    </div>
  );
}

function DataSourceBadge({ isLive }: { isLive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
        isLive
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          : "bg-muted/30 border-border text-muted-foreground/60"
      }`}
    >
      <Database className="h-2.5 w-2.5" />
      {isLive ? "Live data" : "Demo data"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main View
// ─────────────────────────────────────────────────────────────────────────────

export function InsightsView() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [pulseKey, setPulseKey] = useState<number>(0);
  const [newSignalFlash, setNewSignalFlash] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Always fetch all signals — backend signalType != frontend filter category, so
  // type-based pre-filtering is done client-side via mapSignalTypeToCategory.
  const { data: signalsData, loading: signalsLoading } = useMarketSignals();
  const { data: trendsData } = useMarketTrends();
  const { data: opportunitiesData } = useMarketOpportunities();
  const { lastEvent } = useSpecklaBus();

  // Simulate live-update pulse every 30 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setPulseKey((k) => k + 1);
    }, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Flash "New signal detected" when WS delivers an insight
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "insight.created") {
      setNewSignalFlash(true);
      const t = setTimeout(() => setNewSignalFlash(false), 4000);
      return () => clearTimeout(t);
    }
  }, [lastEvent]);

  const handleAddToBrain = (id: string) => {
    setAddedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 3000);
  };

  // Map real signals to UI format
  const hasRealSignals = signalsData?.signals && signalsData.signals.length > 0;

  const mergedSignals: Signal[] = hasRealSignals
    ? signalsData!.signals.slice(0, 15).map((s) => {
        let hostname = "SPECKULA AI";
        if (s.sourceUrl) {
          try {
            hostname = new URL(s.sourceUrl).hostname.replace("www.", "");
          } catch {
            hostname = s.sourceUrl.substring(0, 30);
          }
        }
        return {
          id: s.id,
          source: hostname,
          category: mapSignalTypeToCategory(s.signalType),
          sentiment: s.strength > 0.6 ? "positive" : s.strength < 0.4 ? "negative" : "neutral",
          title: s.title,
          excerpt: s.content.substring(0, 200),
          votes: Math.round(s.strength * 1000),
          comments: Math.round(s.strength * 200),
          timeAgo: formatTimeAgo(s.detectedAt),
          trend: s.strength > 0.8 ? "viral" : s.strength > 0.6 ? "rising" : "stable",
          urgency: s.strength > 0.8 ? "high" : s.strength > 0.5 ? "medium" : "low",
        };
      })
    : [];

  const filteredSignals = mergedSignals.filter((s) => {
    const matchesFilter = activeFilter === "all" || s.category === activeFilter;
    const matchesSearch =
      searchQuery.trim() === "" ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.source.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Map real trends data to UI Trend[] format (empty array when no data)
  const hasRealTrends = trendsData?.byType && trendsData.byType.length > 0;

  const displayTrends: Trend[] = hasRealTrends
    ? trendsData!.byType.slice(0, 6).map((entry) => ({
        name: entry.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        growth: `+${Math.round(entry.avgStrength * 100)}%`,
        volume: `${entry.count} signals`,
        category: mapSignalTypeToTrendCategory(entry.type),
        momentum: Math.round(entry.avgStrength * 100),
      }))
    : [];

  // Map real opportunities data to UI Opportunity[] format (empty array when no data)
  const hasRealOpportunities = opportunitiesData?.opportunities && opportunitiesData.opportunities.length > 0;

  const displayOpportunities: Opportunity[] = hasRealOpportunities
    ? opportunitiesData!.opportunities.slice(0, 4).map((o: MarketOpportunityData) => ({
        title: o.title,
        description: o.content.substring(0, 200),
        strength: Math.round(o.confidence * 100),
        category: o.entryType === "strategic_decision" ? "market_gap" : "feature_demand" as OpportunityCategory,
      }))
    : [];

  const highUrgencyCount = mergedSignals.filter((s) => s.urgency === "high").length;
  const viralCount = mergedSignals.filter((s) => s.trend === "viral").length;

  // suppress pulseKey — used only to drive re-render
  void pulseKey;

  return (
    <div className="flex flex-col h-full bg-background transition-colors duration-300">
      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3 border-b border-border shrink-0 bg-card">
        <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60">
          MARKET INTELLIGENCE
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          <DataSourceBadge isLive={hasRealSignals ?? false} />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-mono text-[9px] sm:text-[10px] text-emerald-400">LIVE</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="p-3 sm:p-4 lg:p-8 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">

          {/* ── New signal flash banner ───────────────────────────────────── */}
          {newSignalFlash && (
            <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] sm:text-[12px] font-medium animate-pulse">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              New signal detected via live monitoring
            </div>
          )}

          {/* ── Page Header ──────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-[28px] font-bold tracking-tight text-foreground">
                Market Intelligence
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Realtime startup market awareness engine
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] sm:text-[12px] text-muted-foreground font-mono">
                {hasRealSignals
                  ? <span>Live · <span className="text-foreground font-semibold">{signalsData!.total} signals</span></span>
                  : <>Updated <span className="text-foreground font-semibold">2 minutes ago</span></>
                }
              </span>
            </div>
          </div>

          {/* ── Top Metrics ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-3">
            <MetricCard
              label="Signals Today"
              value={hasRealSignals ? String(signalsData!.total) : "0"}
              sub={hasRealSignals ? "from live sources" : "capture signals to populate"}
              icon={<Zap className="h-3.5 w-3.5 text-amber-400" />}
              accent="bg-amber-500/10"
            />
            <MetricCard
              label="Trending Topics"
              value={String(displayTrends.length)}
              sub={`${viralCount} viral right now`}
              icon={<Flame className="h-3.5 w-3.5 text-red-400" />}
              accent="bg-red-500/10"
            />
            <MetricCard
              label="Opportunities"
              value={String(displayOpportunities.length)}
              sub={`${highUrgencyCount} high-priority signals`}
              icon={<Target className="h-3.5 w-3.5 text-emerald-400" />}
              accent="bg-emerald-500/10"
            />
            <MetricCard
              label="Sources Monitored"
              value="12"
              sub="Reddit, HN, Twitter, PH"
              icon={<Radio className="h-3.5 w-3.5 text-sky-400" />}
              accent="bg-sky-500/10"
            />
          </div>

          {/* ── Filter Pills + Search ────────────────────────────────────── */}
          <div className="flex flex-col gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 flex-1">
              {FILTER_PILLS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveFilter(id)}
                  aria-current={activeFilter === id ? "page" : undefined}
                  className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full font-mono text-[10px] sm:text-[11px] font-medium whitespace-nowrap border transition-all ${
                    activeFilter === id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-border/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="w-full sm:w-56">
              <Input
                placeholder="Search signals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-[11px] sm:text-[12px] font-mono"
              />
            </div>
          </div>

          {/* ── Main 2-Column Layout ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4 sm:gap-6">

            {/* LEFT: Signal Feed */}
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Activity className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-primary shrink-0" />
                <h2 className="text-[12px] sm:text-[13px] font-semibold text-foreground uppercase tracking-wider font-mono">
                  Signal Feed
                </h2>
                <span className="ml-auto font-mono text-[10px] sm:text-[11px] text-muted-foreground shrink-0">
                  {filteredSignals.length} signal{filteredSignals.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Loading skeleton */}
              {signalsLoading && !hasRealSignals && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-40 rounded-lg sm:rounded-xl border border-border bg-card animate-pulse" />
                  ))}
                </div>
              )}

              {!signalsLoading && filteredSignals.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 rounded-lg sm:rounded-xl border-2 border-dashed border-border text-center p-4 sm:p-6">
                  <AlertTriangle className="h-5 sm:h-6 w-5 sm:w-6 text-muted-foreground/40 mb-2 sm:mb-3" />
                  <p className="text-xs sm:text-sm text-muted-foreground">No signals match this filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {filteredSignals.map((signal) => (
                    <SignalCard
                      key={signal.id}
                      signal={signal}
                      onAddToBrain={handleAddToBrain}
                      addedIds={addedIds}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: Trending Topics + Opportunities */}
            <div className="flex flex-col gap-4 sm:gap-6">

              {/* Trending Topics */}
              <div className="flex flex-col gap-2.5 sm:gap-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <TrendingUp className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-primary shrink-0" />
                  <h2 className="text-[12px] sm:text-[13px] font-semibold text-foreground uppercase tracking-wider font-mono">
                    Trending Topics
                  </h2>
                </div>

                <div className="flex flex-col gap-1.5 sm:gap-2">
                  {displayTrends.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-24 sm:h-28 rounded border-2 sm:rounded-xl border-dashed border-border text-center p-3 sm:p-4">
                      <TrendingUp className="h-4 sm:h-5 w-4 sm:w-5 text-muted-foreground/40 mb-1.5 sm:mb-2" />
                      <p className="text-[11px] sm:text-[12px] text-muted-foreground">No trend data yet.</p>
                    </div>
                  )}
                  {displayTrends.map((trend) => {
                    const badge = getTrendCategoryBadge(trend.category);
                    return (
                      <div
                        key={trend.name}
                        className="flex flex-col gap-1.5 sm:gap-2 p-2.5 sm:p-3.5 rounded border-l-4 sm:rounded-xl border border-border border-l-primary bg-card hover:border-border/80 transition-all"
                      >
                        <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                          <span className="text-[12px] sm:text-[13px] font-medium text-foreground leading-snug">{trend.name}</span>
                          <span className="font-mono text-[10px] sm:text-[11px] font-bold text-emerald-400 shrink-0">{trend.growth}</span>
                        </div>

                        {/* Momentum bar */}
                        <div className="flex flex-col gap-0.5 sm:gap-1">
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${getMomentumColor(trend.momentum)}`}
                              style={{ width: `${trend.momentum}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground truncate">{trend.volume}</span>
                            <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground shrink-0">{trend.momentum}%</span>
                          </div>
                        </div>

                        {/* Category badge */}
                        <span
                          className={`self-start inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-mono font-medium ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Opportunities */}
              <div className="flex flex-col gap-2.5 sm:gap-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Target className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-primary shrink-0" />
                  <h2 className="text-[12px] sm:text-[13px] font-semibold text-foreground uppercase tracking-wider font-mono">
                    Opportunities
                  </h2>
                </div>

                <div className="flex flex-col gap-2 sm:gap-3">
                  {displayOpportunities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-24 sm:h-32 rounded border-2 sm:rounded-xl border-dashed border-border text-center p-3 sm:p-4">
                      <Target className="h-4 sm:h-5 w-4 sm:w-5 text-muted-foreground/40 mb-1.5 sm:mb-2" />
                      <p className="text-[11px] sm:text-[12px] text-muted-foreground">No opportunities detected yet.</p>
                      <p className="text-[10px] sm:text-[11px] text-muted-foreground/60 mt-1">Capture more signals to surface opportunities.</p>
                    </div>
                  ) : displayOpportunities.map((opp) => {
                    const badge = getOpportunityCategoryBadge(opp.category);
                    return (
                      <div
                        key={opp.title}
                        className="flex flex-col gap-2 sm:gap-3 p-2.5 sm:p-4 rounded border-l-4 sm:rounded-xl border border-border border-l-primary bg-card hover:border-border/80 transition-all"
                      >
                        <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                          <h3 className="text-[12px] sm:text-[13px] font-semibold text-foreground leading-snug">{opp.title}</h3>
                          <span className="font-mono text-[11px] sm:text-[12px] font-bold text-foreground shrink-0">{opp.strength}</span>
                        </div>

                        <p className="text-[10px] sm:text-[11px] leading-relaxed text-muted-foreground">{opp.description}</p>

                        {/* Strength bar */}
                        <div className="flex flex-col gap-0.5 sm:gap-1">
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${getStrengthColor(opp.strength)}`}
                              style={{ width: `${opp.strength}%` }}
                            />
                          </div>
                          <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground">Strength</span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-mono font-medium ${badge.bg} ${badge.text}`}
                          >
                            {badge.label}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 sm:px-2.5 text-[9px] sm:text-[10px] font-mono hover:border-primary/60 hover:text-primary hover:bg-primary/5"
                          >
                            <span className="hidden sm:inline">Explore</span>
                            <span className="sm:hidden">View</span>
                            <ChevronRight className="h-2 sm:h-2.5 w-2 sm:w-2.5 ml-0.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── Sources Health ───────────────────────────────────────────── */}
          <div className="flex flex-col gap-2.5 sm:gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <BarChart2 className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-primary shrink-0" />
              <h2 className="text-[12px] sm:text-[13px] font-semibold text-foreground uppercase tracking-wider font-mono">
                Sources Health
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {[
                {
                  name: "Reddit",
                  signals: 18,
                  status: "active" as const,
                  lastSync: "Just now",
                  badge: getSourceBadge("Reddit"),
                },
                {
                  name: "HackerNews",
                  signals: 12,
                  status: "active" as const,
                  lastSync: "1 min ago",
                  badge: getSourceBadge("HackerNews"),
                },
                {
                  name: "Twitter/X",
                  signals: 11,
                  status: "scanning" as const,
                  lastSync: "3 min ago",
                  badge: getSourceBadge("Twitter"),
                },
                {
                  name: "ProductHunt",
                  signals: 6,
                  status: "active" as const,
                  lastSync: "5 min ago",
                  badge: getSourceBadge("ProductHunt"),
                },
              ].map((src) => (
                <div
                  key={src.name}
                  className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-card hover:border-border/80 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-[12px] font-semibold ${src.badge.text}`}>{src.name}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-medium ${
                        src.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {src.status === "active" ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      )}
                      {src.status === "active" ? "Active" : "Scanning"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xl font-bold text-foreground">{src.signals}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">signals today</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                    <span className={`w-1.5 h-1.5 rounded-full ${src.badge.dot}`} />
                    Last sync: {src.lastSync}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
