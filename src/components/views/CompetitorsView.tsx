"use client";

import { useState, useEffect, useRef } from "react";
import {
  Target,
  AlertTriangle,
  Zap,
  Brain,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  Circle,
  XCircle,
  Bell,
  DollarSign,
  Shield,
  Lightbulb,
  Database,
  Plus,
  Clock,
  Loader2,
  WifiOff,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCompetitors,
  useCompetitorChanges,
  useAddCompetitor,
  parseEvidence,
  type CompetitorSummary,
  type CompetitorInsight,
} from "@/hooks/useCompetitors";
import { useSpecklaBus } from "@/hooks/useSpecklaBus";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterTab = "all" | "recent-updates" | "pricing-changes";

// ─── Static Demo Data (shown only when no real data exists, clearly labelled) ──

type MatrixValue = "yes" | "partial" | "no";
interface MatrixRow {
  feature:      string;
  speckula:     MatrixValue;
  notion:       MatrixValue;
  linear:       MatrixValue;
  productboard: MatrixValue;
  figma:        MatrixValue;
  jira:         MatrixValue;
}

const DEMO_MATRIX_ROWS: MatrixRow[] = [
  { feature: "AI Intelligence",     speckula: "yes", notion: "partial", linear: "partial", productboard: "partial", figma: "partial", jira: "partial" },
  { feature: "Market Monitoring",   speckula: "yes", notion: "no",      linear: "no",      productboard: "partial", figma: "no",      jira: "no"      },
  { feature: "Competitor Tracking", speckula: "yes", notion: "no",      linear: "no",      productboard: "no",      figma: "no",      jira: "no"      },
  { feature: "PM Workflow",         speckula: "yes", notion: "partial", linear: "no",      productboard: "yes",     figma: "no",      jira: "yes"     },
  { feature: "Browser Extension",   speckula: "yes", notion: "no",      linear: "no",      productboard: "no",      figma: "no",      jira: "no"      },
  { feature: "Startup Memory",      speckula: "yes", notion: "no",      linear: "no",      productboard: "no",      figma: "no",      jira: "no"      },
];

const DEMO_COLUMNS = ["Notion", "Linear", "Productboard", "Figma", "Jira"];

// ─── Helper to format relative time ──────────────────────────────────────────

function formatTimeAgo(iso: string | null | undefined): string {
  if (!iso) return "–";
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60)  return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffH   = Math.floor(diffMin / 60);
  if (diffH < 24)    return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

// ─── Helper Components ────────────────────────────────────────────────────────

function DataSourceBadge({ isLive, lastUpdated }: { isLive: boolean; lastUpdated?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
      isLive
        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        : "bg-muted/30 border-border text-muted-foreground/60"
    }`}>
      <Database className="h-2.5 w-2.5" />
      {isLive ? (lastUpdated ? `Live · ${lastUpdated}` : "Live data") : "No live data"}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
    pct >= 60 ? "bg-amber-500/10  text-amber-400  border-amber-500/20"  :
                "bg-muted/20       text-muted-foreground/60 border-border";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${color}`}>
      {pct}% conf.
    </span>
  );
}

function StatusBadge({ status }: { status: CompetitorSummary["status"] }) {
  if (status === "queued") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted/30 border border-border text-muted-foreground/70">
        <Clock className="w-2.5 h-2.5" /> Queued
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-500/10 border border-red-500/20 text-red-400">
        <XCircle className="w-2.5 h-2.5" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
      <CheckCircle2 className="w-2.5 h-2.5" /> Monitored
    </span>
  );
}

function MatrixCell({ value, highlight }: { value: MatrixValue; highlight?: boolean }) {
  if (value === "yes")     return <CheckCircle2 className={`w-4 h-4 mx-auto ${highlight ? "text-emerald-400" : "text-emerald-500/70"}`} />;
  if (value === "partial") return <Circle className="w-4 h-4 mx-auto text-amber-500/60" />;
  return <XCircle className="w-4 h-4 mx-auto text-muted-foreground/30" />;
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-32 rounded bg-muted/40" />
          <div className="h-3 w-20 rounded bg-muted/30" />
        </div>
        <div className="h-5 w-20 rounded bg-muted/30" />
      </div>
      <div className="h-3 w-full rounded bg-muted/20" />
      <div className="h-3 w-3/4 rounded bg-muted/20" />
      <div className="flex gap-1.5 mt-1">
        {[1, 2, 3].map((i) => <div key={i} className="h-5 w-16 rounded-md bg-muted/30" />)}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-card border border-dashed border-border rounded-xl">
      <div className="w-12 h-12 rounded-xl bg-muted/20 border border-border flex items-center justify-center mb-4">
        <Target className="w-5 h-5 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">No competitors tracked yet</p>
      <p className="text-[12px] text-muted-foreground mb-4 max-w-xs">
        Add a competitor URL to start monitoring. Insights appear automatically when you visit their pages with the browser extension.
      </p>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onAdd}>
        <Plus className="w-3.5 h-3.5" />
        Add Competitor
      </Button>
    </div>
  );
}

// ─── Add Competitor Modal ─────────────────────────────────────────────────────

function AddCompetitorModal({
  onClose,
  onSuccess,
}: {
  onClose:   () => void;
  onSuccess: (alreadyTracking: boolean) => void;
}) {
  const [url, setUrl]       = useState("");
  const { add, loading, error, clearError } = useAddCompetitor();
  const inputRef            = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const result = await add(trimmed);
    if (result.ok) onSuccess(result.alreadyTracking ?? false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Add Competitor</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Enter the competitor&apos;s website URL to start monitoring.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); if (error) clearError(); }}
            onKeyDown={handleKeyDown}
            placeholder="https://competitor.com"
            className="w-full px-3 py-2 rounded-lg bg-muted/20 border border-border text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-colors"
          />

          {error && (
            <p className="text-[11px] text-red-400 px-1">{error}</p>
          )}

          <p className="text-[10px] text-muted-foreground/50 px-1">
            Insights are captured automatically when you visit this page with the Speckula browser extension.
          </p>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" size="sm" className="text-[12px]" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-[12px] gap-1.5"
              onClick={handleSubmit}
              disabled={loading || !url.trim()}
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
              {loading ? "Adding…" : "Add Competitor"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Real Competitor Card ─────────────────────────────────────────────────────

function RealCompetitorCard({ competitor }: { competitor: CompetitorSummary }) {
  const [expanded, setExpanded] = useState(false);
  const insight   = competitor.latestInsight;
  const evidence  = parseEvidence(insight?.evidence);
  const isQueued  = competitor.status === "queued";

  return (
    <div className={`bg-card border rounded-xl p-5 flex flex-col gap-3 transition-colors ${
      isQueued
        ? "border-muted-foreground/20 opacity-80"
        : "border-emerald-500/20 hover:border-emerald-500/40"
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground tracking-tight">
              {competitor.competitorName ?? competitor.domain}
            </span>
            <StatusBadge status={competitor.status} />
          </div>
          <span className="text-[11px] text-muted-foreground">{competitor.domain}</span>
        </div>
        <span className="text-[10px] text-muted-foreground/60 shrink-0 whitespace-nowrap">
          {formatTimeAgo(competitor.lastCapturedAt)}
        </span>
      </div>

      {/* Queued state */}
      {isQueued && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-muted/20 border border-border">
          <Clock className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground/70">
            Visit this competitor&apos;s site with the Speckula extension to capture intelligence.
          </p>
        </div>
      )}

      {/* Insight types */}
      {competitor.insightTypes.length > 0 && (
        <div>
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-1.5">Tracked Intelligence</p>
          <div className="flex flex-wrap gap-1.5">
            {competitor.insightTypes.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-md bg-muted/30 border border-border text-[11px] text-muted-foreground capitalize">
                {t.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Latest insight with confidence + evidence */}
      {insight && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60">Latest Insight</p>
            <ConfidenceBadge confidence={insight.confidence} />
          </div>
          <div className="bg-muted/10 border border-border rounded-lg p-3 flex flex-col gap-2">
            <p className="text-[12px] font-medium text-foreground leading-snug">{insight.title}</p>

            {/* Expandable: full content */}
            {expanded && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.content}</p>
            )}

            {/* Evidence quotes */}
            {evidence.length > 0 && expanded && (
              <div className="flex flex-col gap-1.5 mt-1">
                {evidence.slice(0, 2).map((quote, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <Quote className="w-3 h-3 text-muted-foreground/30 mt-0.5 shrink-0" />
                    <span className="text-[11px] text-muted-foreground/70 italic">{quote}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-1 transition-colors self-start"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Less detail" : `More${evidence.length > 0 ? ` · ${evidence.length} quote${evidence.length !== 1 ? "s" : ""}` : ""}`}
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
        <span>{competitor.totalInsights} insight{competitor.totalInsights !== 1 ? "s" : ""} captured</span>
      </div>
    </div>
  );
}

// ─── Sample Intelligence Matrix ───────────────────────────────────────────────

function SampleMatrix() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60">Feature Matrix</p>
            <span className="text-[9px] px-1.5 py-0.5 rounded border bg-amber-500/10 border-amber-500/20 text-amber-400 font-medium uppercase tracking-wide">
              Sample Intelligence
            </span>
          </div>
          <h2 className="text-xs sm:text-sm font-semibold text-foreground">Competitive Comparison</h2>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 sm:px-5 py-3 text-[10px] sm:text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide w-32 sm:w-44">
                Capability
              </th>
              <th className="text-center px-2 sm:px-4 py-3 text-[10px] sm:text-[11px] font-semibold text-emerald-400 uppercase tracking-wide bg-emerald-500/5 border-x border-emerald-500/10 w-20 sm:w-28">
                Speckula
              </th>
              {DEMO_COLUMNS.map((name) => (
                <th key={name} className="text-center px-2 sm:px-4 py-3 text-[10px] sm:text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide w-20 sm:w-28">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEMO_MATRIX_ROWS.map((row, i) => (
              <tr key={row.feature} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-muted/5" : ""}`}>
                <td className="px-3 sm:px-5 py-3 text-[11px] sm:text-[12px] font-medium text-foreground/80">{row.feature}</td>
                <td className="px-2 sm:px-4 py-3 bg-emerald-500/5 border-x border-emerald-500/10">
                  <MatrixCell value={row.speckula} highlight />
                </td>
                <td className="px-2 sm:px-4 py-3"><MatrixCell value={row.notion} /></td>
                <td className="px-2 sm:px-4 py-3"><MatrixCell value={row.linear} /></td>
                <td className="px-2 sm:px-4 py-3"><MatrixCell value={row.productboard} /></td>
                <td className="px-2 sm:px-4 py-3"><MatrixCell value={row.figma} /></td>
                <td className="px-2 sm:px-4 py-3"><MatrixCell value={row.jira} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 sm:px-5 py-3 border-t border-border/50 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 text-[11px]">
        <div className="flex items-center gap-1.5 text-muted-foreground/60">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/70" /> Full support
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground/60">
          <Circle className="w-3.5 h-3.5 text-amber-500/60" /> Partial
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground/60">
          <XCircle className="w-3.5 h-3.5 text-muted-foreground/30" /> Not available
        </div>
      </div>
    </div>
  );
}

// ─── Alerts Feed ──────────────────────────────────────────────────────────────

function AlertsFeed({ changes }: { changes: CompetitorInsight[] }) {
  if (changes.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border">
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-0.5">Live Feed</p>
          <h2 className="text-xs sm:text-sm font-semibold text-foreground">Recent Competitor Alerts</h2>
        </div>
        <div className="px-5 py-10 flex flex-col items-center gap-2 text-center">
          <Bell className="w-6 h-6 text-muted-foreground/20" />
          <p className="text-[12px] text-muted-foreground/60">No recent alerts. Visit competitor pages with the extension to capture insights.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2">
        <div>
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-0.5">Live Feed</p>
          <h2 className="text-xs sm:text-sm font-semibold text-foreground">Recent Competitor Alerts</h2>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500 whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          LIVE
        </span>
      </div>
      <div className="divide-y divide-border/50">
        {changes.slice(0, 7).map((ch) => {
          const isPricing = ch.insightType?.includes("pric") || ch.insightType === "monetization";
          const Icon      = isPricing ? DollarSign : ch.insightType === "positioning" ? Brain : Zap;
          const iconColor = isPricing
            ? "text-amber-400 bg-amber-500/10"
            : "text-blue-400 bg-blue-500/10";
          return (
            <div key={ch.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-3 sm:px-5 py-2.5 sm:py-3.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] sm:text-[12px] text-foreground/90 truncate">
                  {ch.competitorName ? `${ch.competitorName}: ` : ""}{ch.title}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ConfidenceBadge confidence={ch.confidence} />
                <span className="text-[10px] sm:text-[11px] text-muted-foreground/50 sm:w-10 sm:text-right">
                  {formatTimeAgo(ch.capturedAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function CompetitorsView() {
  const [activeFilter,    setActiveFilter]    = useState<FilterTab>("all");
  const [showModal,       setShowModal]       = useState(false);
  const [newInsightFlash, setNewInsightFlash] = useState(false);
  const [toast,           setToast]           = useState<string | null>(null);

  const { data: competitorsData, loading, error } = useCompetitors();
  const { data: changesData }                     = useCompetitorChanges();
  const { connected, lastEvent }                  = useSpecklaBus();

  // Flash on competitor-scoped events only.
  useEffect(() => {
    if (!lastEvent) return;
    if (
      lastEvent.type === "competitor.insight.created" ||
      lastEvent.type === "competitor.updated"
    ) {
      setNewInsightFlash(true);
      const t = setTimeout(() => setNewInsightFlash(false), 3000);
      return () => clearTimeout(t);
    }
  }, [lastEvent]);

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleAddSuccess = (alreadyTracking: boolean) => {
    setShowModal(false);
    setToast(alreadyTracking ? "Already tracking this competitor." : "Competitor added. Visit their site with the extension to capture intelligence.");
  };

  const competitors = competitorsData?.competitors ?? [];
  const changes     = changesData?.changes ?? [];
  const hasData     = competitors.length > 0;

  const lastUpdatedTime = changes.length > 0 ? formatTimeAgo(changes[0].capturedAt) : undefined;

  // Filter for the grid (only non-queued competitors can be filtered meaningfully).
  const filtered = competitors.filter((c) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "recent-updates") {
      if (!c.lastCapturedAt) return false;
      const diffH = (Date.now() - new Date(c.lastCapturedAt).getTime()) / 3_600_000;
      return diffH <= 24;
    }
    if (activeFilter === "pricing-changes") {
      return c.insightTypes.some((t) => t === "pricing" || t === "monetization");
    }
    return true;
  });

  // Summary counts from real data only.
  const totalTracked   = competitors.length;
  const totalInsights  = changes.length;
  const queuedCount    = competitors.filter((c) => c.status === "queued").length;

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: "all",              label: "All" },
    { id: "recent-updates",   label: "Recent Updates" },
    { id: "pricing-changes",  label: "Pricing Changes" },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex flex-col gap-4 sm:gap-5 lg:gap-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground tracking-tight">
            Competitor Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-0.5">
            {hasData
              ? `Monitoring ${totalTracked} competitor${totalTracked !== 1 ? "s" : ""}${queuedCount > 0 ? ` · ${queuedCount} queued` : ""}`
              : "Add competitors to start monitoring"}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 shrink-0">
          {!connected && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/30 border border-border text-muted-foreground/60 whitespace-nowrap">
              <WifiOff className="h-2.5 w-2.5 shrink-0" /> Offline
            </span>
          )}
          <DataSourceBadge isLive={hasData && connected} lastUpdated={lastUpdatedTime} />
          <Button variant="outline" size="sm" className="gap-1.5 justify-center sm:w-auto" onClick={() => setShowModal(true)}>
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Add Competitor</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card border border-border text-[12px] text-foreground/80 shadow-md">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          {toast}
        </div>
      )}

      {/* ── New insight flash banner ── */}
      {newInsightFlash && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] font-medium animate-pulse">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          New competitor insight detected via live monitoring
        </div>
      )}

      {/* ── Error state ── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Could not load competitor data: {error}
        </div>
      )}

      {/* ── Summary Metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 lg:p-6">
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-2">Competitors Tracked</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground tabular-nums">{totalTracked || "–"}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {totalTracked > 0 ? `${competitors.filter((c) => c.status === "completed").length} active` : "None yet"}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 lg:p-6">
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-2">Insights Captured</p>
          <div className="flex items-end gap-1">
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground tabular-nums">{totalInsights || "–"}</p>
            <Bell className="w-4 h-4 text-amber-400 mb-1" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {totalInsights > 0 ? "Last 30 days" : "Visit competitor sites"}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 lg:p-6">
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-2">Pricing Intelligence</p>
          <div className="flex items-end gap-1">
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-amber-400 tabular-nums">
              {changes.filter((c) => c.insightType === "pricing" || c.insightType === "monetization").length || "–"}
            </p>
            <DollarSign className="w-4 h-4 text-amber-400/70 mb-1" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Pricing observations</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 lg:p-6">
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-2">Opportunities</p>
          <div className="flex items-end gap-1">
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-emerald-400 tabular-nums">
              {changes.filter((c) => c.insightType === "ux" || c.insightType === "positioning").length || "–"}
            </p>
            <Lightbulb className="w-4 h-4 text-emerald-400/70 mb-1" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">UX & positioning gaps</p>
        </div>
      </div>

      {/* ── Loading skeletons ── */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {/* ── Empty state (no data, not loading) ── */}
      {!loading && !error && !hasData && (
        <EmptyState onAdd={() => setShowModal(true)} />
      )}

      {/* ── Competitor Grid ── */}
      {!loading && hasData && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-1 bg-muted/20 border border-border rounded-lg p-1 w-full sm:w-fit overflow-x-auto">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md text-[11px] sm:text-[12px] font-medium transition-colors whitespace-nowrap ${
                  activeFilter === tab.id
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-muted-foreground/60 bg-card border border-dashed border-border rounded-xl">
              No competitors match this filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((c) => (
                <RealCompetitorCard key={c.domain} competitor={c} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Alerts Feed (real data only) ── */}
      {!loading && <AlertsFeed changes={changes} />}

      {/* ── Sample Intelligence Matrix (always shown, clearly labelled) ── */}
      <SampleMatrix />

      {/* ── Add Competitor Modal ── */}
      {showModal && (
        <AddCompetitorModal
          onClose={() => setShowModal(false)}
          onSuccess={handleAddSuccess}
        />
      )}
    </div>
  );
}
