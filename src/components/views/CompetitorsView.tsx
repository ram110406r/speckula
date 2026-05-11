"use client";

import { useState } from "react";
import {
  Target,
  AlertTriangle,
  Zap,
  Brain,
  TrendingDown,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type ThreatLevel = "high" | "medium" | "low";
type CompetitorStatus = "active" | "stale";

interface Pricing {
  free: string;
  pro: string;
  business: string;
  enterprise: string;
}

interface Competitor {
  id: string;
  name: string;
  domain: string;
  category: string;
  lastUpdate: string;
  status: CompetitorStatus;
  threat: ThreatLevel;
  pricing: Pricing;
  recentChanges: string[];
  positioning: string;
  weaknesses: string[];
  userComplaints: string[];
  features: string[];
  score: number;
}

type FilterTab = "all" | "high-threat" | "recent-updates" | "pricing-changes";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const COMPETITORS: Competitor[] = [
  {
    id: "notion",
    name: "Notion",
    domain: "notion.so",
    category: "Workspace & PM",
    lastUpdate: "2h ago",
    status: "active",
    threat: "high",
    pricing: { free: "$0", pro: "$12/mo", business: "$18/mo", enterprise: "Custom" },
    recentChanges: ["Raised Business plan by 15%", "Launched Notion AI v2", "Added Q&A feature"],
    positioning: "All-in-one workspace for notes, docs, and wikis",
    weaknesses: ["Complex onboarding", "Performance on large docs", "No realtime collaboration"],
    userComplaints: ["Too slow for large databases", "Pricing increase frustrating", "AI feels bolted on"],
    features: ["Docs", "Database", "AI", "Templates", "API", "Integrations"],
    score: 78,
  },
  {
    id: "linear",
    name: "Linear",
    domain: "linear.app",
    category: "Issue Tracking",
    lastUpdate: "5h ago",
    status: "active",
    threat: "medium",
    pricing: { free: "$0", pro: "$8/mo", business: "$14/mo", enterprise: "Custom" },
    recentChanges: ["Shipped timeline view", "Added AI issue generation", "New keyboard shortcuts"],
    positioning: "The issue tracking tool built for modern software teams",
    weaknesses: ["No PM workflow", "Limited AI features", "No market intelligence"],
    userComplaints: ["Missing roadmap features", "Hard to link strategy to execution", "No customer insights"],
    features: ["Issues", "Cycles", "Projects", "Roadmaps", "AI", "Integrations"],
    score: 65,
  },
  {
    id: "productboard",
    name: "Productboard",
    domain: "productboard.com",
    category: "Product Management",
    lastUpdate: "1d ago",
    status: "active",
    threat: "high",
    pricing: { free: "Trial", pro: "$25/mo", business: "$75/mo", enterprise: "Custom" },
    recentChanges: ["Added AI feature prioritization", "New insights module", "Jira sync improved"],
    positioning: "Product management platform that helps teams build the right products",
    weaknesses: ["Expensive at scale", "Slow UI", "Complex setup"],
    userComplaints: ["Too expensive for early-stage", "Not intuitive", "AI features are shallow"],
    features: ["Insights", "Prioritization", "Roadmaps", "Portal", "Integrations", "AI"],
    score: 71,
  },
  {
    id: "figma",
    name: "Figma",
    domain: "figma.com",
    category: "Design & Collaboration",
    lastUpdate: "3h ago",
    status: "active",
    threat: "low",
    pricing: { free: "$0", pro: "$12/mo", business: "$45/mo", enterprise: "Custom" },
    recentChanges: ["Launched Figma AI", "New variables system", "Dev Mode GA"],
    positioning: "The collaborative design platform powering the future",
    weaknesses: ["Not for PM workflows", "Performance in complex files", "Limited prototyping"],
    userComplaints: ["Offline mode needed", "Heavy on battery", "Font rendering issues"],
    features: ["Design", "Prototyping", "Dev Mode", "AI", "Plugins", "Comments"],
    score: 45,
  },
  {
    id: "jira",
    name: "Jira",
    domain: "atlassian.com",
    category: "Project Management",
    lastUpdate: "2d ago",
    status: "stale",
    threat: "medium",
    pricing: { free: "$0", pro: "$7.75/mo", business: "$15.25/mo", enterprise: "Custom" },
    recentChanges: ["New AI summary feature", "Performance improvements", "Updated roadmap view"],
    positioning: "Plan, track, and release great software",
    weaknesses: ["Complex configuration", "Slow performance", "Overwhelming UI"],
    userComplaints: ["Way too complex", "Slowest tool in stack", "Too many clicks", "Dated UI"],
    features: ["Issues", "Agile", "Roadmaps", "Reports", "Automation", "Integrations"],
    score: 52,
  },
];

const RECENT_ALERTS = [
  {
    id: "a1",
    icon: AlertTriangle,
    description: "Notion: Business plan price increase detected",
    time: "2h ago",
    competitor: "Notion",
    type: "pricing",
  },
  {
    id: "a2",
    icon: Zap,
    description: "Linear: New feature shipped (Timeline)",
    time: "5h ago",
    competitor: "Linear",
    type: "feature",
  },
  {
    id: "a3",
    icon: Brain,
    description: "Productboard: Launched AI prioritization",
    time: "1d ago",
    competitor: "Productboard",
    type: "feature",
  },
  {
    id: "a4",
    icon: DollarSign,
    description: "Figma: Dev Mode moved to paid tier",
    time: "1d ago",
    competitor: "Figma",
    type: "pricing",
  },
  {
    id: "a5",
    icon: Zap,
    description: "Jira: AI summary feature now in beta",
    time: "2d ago",
    competitor: "Jira",
    type: "feature",
  },
];

// ─── Comparison Matrix Data ───────────────────────────────────────────────────

type MatrixValue = "yes" | "partial" | "no";

interface MatrixRow {
  feature: string;
  speckula: MatrixValue;
  notion: MatrixValue;
  linear: MatrixValue;
  productboard: MatrixValue;
  figma: MatrixValue;
  jira: MatrixValue;
}

const MATRIX_ROWS: MatrixRow[] = [
  { feature: "AI Intelligence",        speckula: "yes", notion: "partial", linear: "partial", productboard: "partial", figma: "partial", jira: "partial" },
  { feature: "Market Monitoring",      speckula: "yes", notion: "no",      linear: "no",      productboard: "partial", figma: "no",      jira: "no"      },
  { feature: "Competitor Tracking",    speckula: "yes", notion: "no",      linear: "no",      productboard: "no",      figma: "no",      jira: "no"      },
  { feature: "PM Workflow",            speckula: "yes", notion: "partial", linear: "no",      productboard: "yes",     figma: "no",      jira: "yes"     },
  { feature: "Browser Extension",      speckula: "yes", notion: "no",      linear: "no",      productboard: "no",      figma: "no",      jira: "no"      },
  { feature: "Startup Memory",         speckula: "yes", notion: "no",      linear: "no",      productboard: "no",      figma: "no",      jira: "no"      },
];

// ─── Helper Components ────────────────────────────────────────────────────────

function ThreatBadge({ level }: { level: ThreatLevel }) {
  const styles: Record<ThreatLevel, string> = {
    high: "bg-red-500/10 text-red-400 border border-red-500/20",
    medium: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    low: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${styles[level]}`}>
      <Shield className="w-3 h-3" />
      {level.charAt(0).toUpperCase() + level.slice(1)} Threat
    </span>
  );
}

function MatrixCell({ value, highlight }: { value: MatrixValue; highlight?: boolean }) {
  if (value === "yes") return <CheckCircle2 className={`w-4 h-4 mx-auto ${highlight ? "text-emerald-400" : "text-emerald-500/70"}`} />;
  if (value === "partial") return <Circle className="w-4 h-4 mx-auto text-amber-500/60" />;
  return <XCircle className="w-4 h-4 mx-auto text-muted-foreground/30" />;
}

function ScoreBar({ score, threat }: { score: number; threat: ThreatLevel }) {
  const color: Record<ThreatLevel, string> = {
    high: "bg-red-500",
    medium: "bg-amber-500",
    low: "bg-emerald-500",
  };
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div
          className={`h-full rounded-full ${color[threat]} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-[11px] text-muted-foreground tabular-nums w-7 text-right">{score}</span>
    </div>
  );
}

// ─── Competitor Card ──────────────────────────────────────────────────────────

function CompetitorCard({
  competitor,
  expanded,
  onToggleExpand,
}: {
  competitor: Competitor;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const categoryColors: Record<string, string> = {
    "Workspace & PM": "bg-violet-500/10 text-violet-400 border-violet-500/20",
    "Issue Tracking": "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "Product Management": "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    "Design & Collaboration": "bg-pink-500/10 text-pink-400 border-pink-500/20",
    "Project Management": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };

  const catStyle = categoryColors[competitor.category] ?? "bg-muted/20 text-muted-foreground border-border";

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-border/80 transition-colors flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-foreground tracking-tight">{competitor.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${catStyle}`}>
              {competitor.category}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">{competitor.domain}</span>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <ThreatBadge level={competitor.threat} />
          <span className="text-[10px] text-muted-foreground/60">{competitor.lastUpdate}</span>
        </div>
      </div>

      {/* Pricing */}
      <div>
        <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-2">Pricing</p>
        <div className="flex gap-2 flex-wrap">
          {(["free", "pro", "business", "enterprise"] as const).map((tier) => (
            <span
              key={tier}
              className="inline-flex flex-col items-center px-2.5 py-1.5 bg-muted/20 border border-border rounded-lg"
            >
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 leading-none mb-0.5">
                {tier}
              </span>
              <span className="text-[11px] font-medium text-foreground">{competitor.pricing[tier]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Recent Changes */}
      <div>
        <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-2">Recent Changes</p>
        <ul className="flex flex-col gap-1">
          {competitor.recentChanges.map((change, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />
              <span className="text-[12px] text-muted-foreground">{change}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Positioning */}
      <div>
        <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-1.5">Positioning</p>
        <p className="text-[12px] italic text-muted-foreground/80 border-l-2 border-border pl-3">
          &ldquo;{competitor.positioning}&rdquo;
        </p>
      </div>

      {/* Weaknesses / Opportunities */}
      <div>
        <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-2">
          Weaknesses{" "}
          <span className="normal-case text-emerald-500/60 ml-1">= Speckula Opportunities</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {competitor.weaknesses.map((w, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/5 border border-emerald-500/15 text-emerald-400 text-[11px]"
            >
              <TrendingDown className="w-3 h-3" />
              {w}
            </span>
          ))}
        </div>
      </div>

      {/* User Complaints */}
      <div>
        <button
          className="w-full flex items-center justify-between group"
          onClick={onToggleExpand}
        >
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60">
            User Complaints
          </p>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          )}
        </button>
        <div className="mt-2 flex flex-col gap-1">
          {competitor.userComplaints.slice(0, expanded ? undefined : 2).map((c, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-[11px] text-muted-foreground/70"
            >
              <X className="w-3 h-3 mt-0.5 text-red-400/60 shrink-0" />
              {c}
            </div>
          ))}
          {!expanded && competitor.userComplaints.length > 2 && (
            <button
              className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground text-left mt-0.5 transition-colors"
              onClick={onToggleExpand}
            >
              +{competitor.userComplaints.length - 2} more
            </button>
          )}
        </div>
      </div>

      {/* Feature Tags */}
      <div>
        <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-2">Features</p>
        <div className="flex flex-wrap gap-1.5">
          {competitor.features.map((f) => (
            <span
              key={f}
              className="px-2 py-0.5 rounded-md bg-muted/30 border border-border text-[11px] text-muted-foreground"
            >
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom: Score + CTA */}
      <div className="flex items-center gap-3 pt-1 border-t border-border/50">
        <div className="flex-1">
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-1.5">Threat Score</p>
          <ScoreBar score={competitor.score} threat={competitor.threat} />
        </div>
        <Button variant="outline" size="sm" className="shrink-0 text-[11px] h-7 px-3">
          View Full Analysis
        </Button>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function CompetitorsView() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "high-threat", label: "High Threat" },
    { id: "recent-updates", label: "Recent Updates" },
    { id: "pricing-changes", label: "Pricing Changes" },
  ];

  const filteredCompetitors = COMPETITORS.filter((c) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "high-threat") return c.threat === "high";
    if (activeFilter === "recent-updates") return c.lastUpdate.includes("h");
    if (activeFilter === "pricing-changes")
      return c.recentChanges.some(
        (ch) =>
          ch.toLowerCase().includes("pric") ||
          ch.toLowerCase().includes("plan") ||
          ch.toLowerCase().includes("cost")
      );
    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Competitor Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitoring 5 competitors across 4 categories
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
          <Target className="w-3.5 h-3.5" />
          Add Competitor
        </Button>
      </div>

      {/* ── Summary Metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-2">
            Competitors Tracked
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">5</p>
          <p className="text-[11px] text-muted-foreground mt-1">Across 4 categories</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-2">
            Alerts This Week
          </p>
          <div className="flex items-end gap-1">
            <p className="text-2xl font-bold text-foreground tabular-nums">12</p>
            <Bell className="w-4 h-4 text-amber-400 mb-1" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">3 pricing · 9 feature</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-2">
            High Threat
          </p>
          <div className="flex items-end gap-1">
            <p className="text-2xl font-bold text-red-400 tabular-nums">2</p>
            <AlertTriangle className="w-4 h-4 text-red-400/70 mb-1" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Notion · Productboard</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-2">
            Opportunities
          </p>
          <div className="flex items-end gap-1">
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">7</p>
            <Lightbulb className="w-4 h-4 text-emerald-400/70 mb-1" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">From competitor weaknesses</p>
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-1 bg-muted/20 border border-border rounded-lg p-1 w-fit">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              activeFilter === tab.id
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Competitor Cards Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredCompetitors.map((competitor) => (
          <CompetitorCard
            key={competitor.id}
            competitor={competitor}
            expanded={expandedId === competitor.id}
            onToggleExpand={() =>
              setExpandedId(expandedId === competitor.id ? null : competitor.id)
            }
          />
        ))}
      </div>

      {/* ── Comparison Matrix ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-0.5">
            Feature Matrix
          </p>
          <h2 className="text-sm font-semibold text-foreground">Competitive Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide w-44">
                  Capability
                </th>
                <th className="text-center px-4 py-3 text-[11px] font-semibold text-emerald-400 uppercase tracking-wide bg-emerald-500/5 border-x border-emerald-500/10 w-28">
                  Speckula
                </th>
                {COMPETITORS.map((c) => (
                  <th
                    key={c.id}
                    className="text-center px-4 py-3 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide w-28"
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`border-b border-border/50 ${i % 2 === 0 ? "bg-muted/5" : ""}`}
                >
                  <td className="px-5 py-3 text-[12px] font-medium text-foreground/80">
                    {row.feature}
                  </td>
                  <td className="px-4 py-3 bg-emerald-500/5 border-x border-emerald-500/10">
                    <MatrixCell value={row.speckula} highlight />
                  </td>
                  <td className="px-4 py-3"><MatrixCell value={row.notion} /></td>
                  <td className="px-4 py-3"><MatrixCell value={row.linear} /></td>
                  <td className="px-4 py-3"><MatrixCell value={row.productboard} /></td>
                  <td className="px-4 py-3"><MatrixCell value={row.figma} /></td>
                  <td className="px-4 py-3"><MatrixCell value={row.jira} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-border/50 flex items-center gap-5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/70" /> Full support
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
            <Circle className="w-3.5 h-3.5 text-amber-500/60" /> Partial
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
            <XCircle className="w-3.5 h-3.5 text-muted-foreground/30" /> Not available
          </div>
        </div>
      </div>

      {/* ── Recent Alerts Feed ── */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border">
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground/60 mb-0.5">
            Live Feed
          </p>
          <h2 className="text-sm font-semibold text-foreground">Recent Competitor Alerts</h2>
        </div>
        <div className="divide-y divide-border/50">
          {RECENT_ALERTS.map((alert) => {
            const Icon = alert.icon;
            const iconColor =
              alert.type === "pricing" ? "text-amber-400 bg-amber-500/10" : "text-blue-400 bg-blue-500/10";
            return (
              <div key={alert.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-foreground/90 truncate">{alert.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded-md bg-muted/30 border border-border text-[10px] text-muted-foreground">
                    {alert.competitor}
                  </span>
                  <span className="text-[11px] text-muted-foreground/50 w-10 text-right">{alert.time}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
