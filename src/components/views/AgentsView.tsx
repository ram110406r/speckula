"use client";

import React, { useState, useEffect } from "react";
import {
  Bot,
  Loader2,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  AlertCircle,
  Activity,
  Zap,
  Brain,
  Radio,
  BarChart2,
  Calendar,
  TrendingUp,
  Shield,
  Target,
  ChevronRight,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgents, useAgentJobs } from "@/hooks/useAgents";
import { useSpecklaBus } from "@/hooks/useSpecklaBus";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentStatus = "running" | "idle" | "scheduled";
type AgentType = "intelligence" | "synthesis" | "analysis" | "delivery";
type LogStatus = "success" | "alert" | "info" | "error";

interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  type: AgentType;
  lastRun: string;
  nextRun: string;
  tasksCompleted: number;
  successRate: number;
  currentTask: string | null;
  uptime: string;
}

interface ExecutionLogEntry {
  id: string;
  agent: string;
  action: string;
  detail: string;
  time: string;
  status: LogStatus;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const AGENTS: Agent[] = [
  {
    id: "market-scanner",
    name: "Market Scanner",
    description: "Monitors Reddit, HN, Twitter for market signals",
    status: "running",
    type: "intelligence",
    lastRun: "2m ago",
    nextRun: "Continuous",
    tasksCompleted: 1247,
    successRate: 97,
    currentTask: "Scanning r/startups for PM tool discussions",
    uptime: "99.2%",
  },
  {
    id: "competitor-watcher",
    name: "Competitor Watcher",
    description: "Tracks pricing, features, and positioning changes",
    status: "running",
    type: "intelligence",
    lastRun: "8m ago",
    nextRun: "Every 15m",
    tasksCompleted: 892,
    successRate: 99,
    currentTask: "Analyzing notion.so pricing page changes",
    uptime: "98.7%",
  },
  {
    id: "insight-synthesizer",
    name: "Insight Synthesizer",
    description: "Synthesizes signals into actionable PM insights",
    status: "running",
    type: "synthesis",
    lastRun: "23m ago",
    nextRun: "Every 1h",
    tasksCompleted: 234,
    successRate: 94,
    currentTask: "Generating weekly intelligence digest",
    uptime: "97.1%",
  },
  {
    id: "decision-scorer",
    name: "Decision Scorer",
    description: "Scores and validates strategic decisions",
    status: "idle",
    type: "analysis",
    lastRun: "2h ago",
    nextRun: "On trigger",
    tasksCompleted: 67,
    successRate: 91,
    currentTask: null,
    uptime: "100%",
  },
  {
    id: "experiment-analyzer",
    name: "Experiment Analyzer",
    description: "Monitors A/B tests and extracts learnings",
    status: "running",
    type: "analysis",
    lastRun: "45m ago",
    nextRun: "Every 4h",
    tasksCompleted: 34,
    successRate: 88,
    currentTask: "Processing onboarding A/B test results",
    uptime: "96.4%",
  },
  {
    id: "weekly-digest",
    name: "Weekly Digest",
    description: "Compiles and sends weekly intelligence summaries",
    status: "scheduled",
    type: "delivery",
    lastRun: "3d ago",
    nextRun: "Monday 9am",
    tasksCompleted: 12,
    successRate: 100,
    currentTask: null,
    uptime: "100%",
  },
];

const EXECUTION_LOG: ExecutionLogEntry[] = [
  {
    id: "1",
    agent: "Market Scanner",
    action: "Signal detected",
    detail: '47 mentions of "PM tool switching" on Reddit r/startups',
    time: "2m ago",
    status: "success",
  },
  {
    id: "2",
    agent: "Competitor Watcher",
    action: "Change detected",
    detail: "Notion.so updated pricing page — Business plan +$3/mo",
    time: "8m ago",
    status: "alert",
  },
  {
    id: "3",
    agent: "Insight Synthesizer",
    action: "Insight generated",
    detail: '"AI-native tools" category growing 512% — high opportunity',
    time: "23m ago",
    status: "success",
  },
  {
    id: "4",
    agent: "Market Scanner",
    action: "Viral signal",
    detail: "HackerNews: DIY competitor monitoring — 3K upvotes",
    time: "35m ago",
    status: "success",
  },
  {
    id: "5",
    agent: "Experiment Analyzer",
    action: "Result updated",
    detail: "Onboarding B +23% activation at n=234",
    time: "45m ago",
    status: "success",
  },
  {
    id: "6",
    agent: "Decision Scorer",
    action: "Score updated",
    detail: 'Decision "Launch freemium" scored 91/100',
    time: "2h ago",
    status: "success",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<AgentType, { label: string; color: string; bg: string }> = {
  intelligence: { label: "Intelligence", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  synthesis: { label: "Synthesis", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  analysis: { label: "Analysis", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  delivery: { label: "Delivery", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
};

const TYPE_ICON: Record<AgentType, React.ElementType> = {
  intelligence: Radio,
  synthesis: Brain,
  analysis: Target,
  delivery: Zap,
};

/** Map a backend agent type string to our AgentType union (best-effort). */
function toAgentType(raw: string): AgentType {
  const lower = raw.toLowerCase();
  if (lower.includes("intel") || lower.includes("scan") || lower.includes("watch")) return "intelligence";
  if (lower.includes("synth") || lower.includes("digest")) return "synthesis";
  if (lower.includes("deliv") || lower.includes("notify")) return "delivery";
  return "analysis";
}

function StatusIndicator({ status }: { status: AgentStatus }) {
  if (status === "running") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        Running
      </span>
    );
  }
  if (status === "scheduled") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-500">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Scheduled
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
      <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
      Idle
    </span>
  );
}

function TypeBadge({ type }: { type: AgentType }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-[13px] font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function MetricCard({ label, value, sub, live = false }: { label: string; value: string | number; sub?: string; live?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        {live && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
      </div>
      <span className="text-2xl font-bold tracking-tight text-foreground leading-none">{value}</span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

/** Skeleton card shown while loading. */
function AgentCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3 w-28 rounded bg-muted" />
            <div className="h-2.5 w-44 rounded bg-muted/60" />
          </div>
        </div>
        <div className="h-2.5 w-16 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-3 gap-3 py-2 border-y border-border/50">
        <div className="h-8 rounded bg-muted/60" />
        <div className="h-8 rounded bg-muted/60" />
        <div className="h-8 rounded bg-muted/60" />
      </div>
      <div className="h-8 rounded bg-muted/40" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data-source badge
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Agent Card
// ---------------------------------------------------------------------------

interface AgentCardProps {
  agent: Agent;
  onToggle: (id: string) => void;
  pulsing?: boolean;
}

function AgentCard({ agent, onToggle, pulsing = false }: AgentCardProps) {
  const TypeIcon = TYPE_ICON[agent.type];

  return (
    <div
      className={`bg-card border rounded-xl p-5 flex flex-col gap-4 hover:border-border/80 transition-colors ${
        pulsing ? "border-emerald-500/40 shadow-[0_0_0_2px_rgba(16,185,129,0.15)]" : "border-border"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
            <TypeIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[13px] font-semibold text-foreground leading-snug">{agent.name}</h3>
              <TypeBadge type={agent.type} />
              {pulsing && (
                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-400 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug">{agent.description}</p>
          </div>
        </div>
        <StatusIndicator status={agent.status} />
      </div>

      {/* Current task */}
      {agent.currentTask && (
        <div className="flex items-start gap-2 bg-muted/40 rounded-lg px-3 py-2.5">
          <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0 mt-0.5" />
          <p className="text-[11.5px] italic text-muted-foreground leading-snug">{agent.currentTask}</p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 py-2 border-y border-border/50">
        <StatPill label="Completed" value={agent.tasksCompleted.toLocaleString()} />
        <StatPill label="Success" value={`${agent.successRate}%`} />
        <StatPill label="Uptime" value={agent.uptime} />
      </div>

      {/* Timing */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          Last: {agent.lastRun}
        </span>
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
          Next: {agent.nextRun}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {agent.status === "running" ? (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs gap-1.5"
            onClick={() => onToggle(agent.id)}
          >
            <Pause className="h-3 w-3" />
            Pause
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs gap-1.5"
            onClick={() => onToggle(agent.id)}
          >
            <Play className="h-3 w-3" />
            Run Now
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-8 text-xs px-2.5 gap-1">
          Details
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Execution Log
// ---------------------------------------------------------------------------

function ExecutionLog({ entries, isLive }: { entries: ExecutionLogEntry[]; isLive: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[13px] font-semibold text-foreground">Execution Log</span>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      </div>
      <ul>
        {entries.map((entry, idx) => (
          <li
            key={entry.id}
            className="flex items-start gap-4 px-5 py-3.5 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
          >
            {/* Timeline connector */}
            <div className="flex flex-col items-center shrink-0 mt-0.5">
              {entry.status === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : entry.status === "error" ? (
                <AlertCircle className="h-4 w-4 text-red-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500" />
              )}
              {idx < entries.length - 1 && (
                <div className="w-px flex-1 bg-border/50 mt-1 min-h-[12px]" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-foreground">{entry.agent}</span>
                <span className="text-[11px] text-muted-foreground">·</span>
                <span className="text-[11px] font-medium text-muted-foreground">{entry.action}</span>
              </div>
              <p className="text-[12px] text-foreground leading-snug">{entry.detail}</p>
            </div>

            {/* Time */}
            <span className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1 mt-0.5">
              <Clock className="h-2.5 w-2.5" />
              {entry.time}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AgentsView() {
  const [agentOverrides, setAgentOverrides] = useState<Record<string, AgentStatus>>({});
  const [tickCount, setTickCount] = useState(0);

  // Real data from backend
  const { data: agentsData, loading: agentsLoading } = useAgents();
  const { data: jobsData } = useAgentJobs();
  const { lastEvent } = useSpecklaBus();

  // Track which agent is currently pulsing from a WS event
  const [pulsingJobId, setPulsingJobId] = useState<string | null>(null);

  // Simulate live task progress tick
  useEffect(() => {
    const timer = setInterval(() => {
      setTickCount((prev) => prev + 1);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // When a WS event arrives for analysis.completed / analysis.progress, pulse
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "analysis.completed" || lastEvent.type === "analysis.progress") {
      const data = (lastEvent as { data?: unknown }).data;
      if (!data || typeof data !== "object") return;
      if (!("jobId" in data)) return;
      const jobId = (data as { jobId?: unknown }).jobId;
      if (typeof jobId !== "string") return;

      setPulsingJobId(jobId);
      const t = setTimeout(() => setPulsingJobId(null), 4000);
      return () => clearTimeout(t);
    }
  }, [lastEvent]);

  // Map real agent data → UI Agent[] format, falling back to mock
  const hasRealAgents = agentsData?.agents && agentsData.agents.length > 0;

  const displayAgents: Agent[] = hasRealAgents
    ? agentsData!.agents.map((a) => ({
        id: a.name.toLowerCase().replace(/\s/g, "-"),
        name: a.name,
        description: "AI-powered analysis agent",
        status: (agentOverrides[a.name.toLowerCase().replace(/\s/g, "-")] ?? a.status) as AgentStatus,
        type: toAgentType(a.type),
        lastRun: a.lastActivity ? new Date(a.lastActivity).toLocaleTimeString() : "Never",
        nextRun: a.status === "running" ? "Continuous" : "On trigger",
        tasksCompleted: a.completedTotal,
        successRate:
          a.completedTotal > 0
            ? Math.round((a.completedTotal / (a.completedTotal + a.failedTotal)) * 100)
            : 100,
        currentTask: a.status === "running" ? "Processing analysis queue..." : null,
        uptime: "99.0%",
      }))
    : AGENTS.map((a) => ({
        ...a,
        status: (agentOverrides[a.id] ?? a.status) as AgentStatus,
      }));

  // Map real jobs → execution log format, falling back to mock
  const hasRealJobs = jobsData?.jobs && jobsData.jobs.length > 0;

  const displayLog: ExecutionLogEntry[] = hasRealJobs
    ? jobsData!.jobs.slice(0, 6).map((j) => ({
        id: j.id,
        agent: j.pageType ?? "Analysis Engine",
        action:
          j.status === "completed"
            ? "Analysis completed"
            : j.status === "failed"
            ? "Analysis failed"
            : "Processing",
        detail: j.sourceUrl
          ? `Analyzed: ${j.sourceUrl.substring(0, 60)}...`
          : `Job ${j.id.substring(0, 8)}`,
        time: new Date(j.createdAt).toLocaleTimeString(),
        status:
          j.status === "completed"
            ? "success"
            : j.status === "failed"
            ? "error"
            : "info",
      }))
    : EXECUTION_LOG;

  const handleToggle = (id: string) => {
    setAgentOverrides((prev) => {
      const current = prev[id] ?? displayAgents.find((a) => a.id === id)?.status ?? "idle";
      return { ...prev, [id]: current === "running" ? "idle" : "running" };
    });
  };

  const agents = displayAgents;
  const running = agents.filter((a) => a.status === "running").length;
  const idle = agents.filter((a) => a.status === "idle").length;
  const scheduled = agents.filter((a) => a.status === "scheduled").length;
  const tasksToday = agents.reduce((sum, a) => sum + Math.floor(a.tasksCompleted / 5), 0);

  // Suppress unused tickCount warning — it drives re-render for "live" feel
  void tickCount;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-[1280px] mx-auto px-5 py-6 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-foreground leading-tight">AI Agents</h1>
              <p className="text-[11px] text-muted-foreground">
                {agents.length} agents · {running} running · autonomous
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DataSourceBadge isLive={hasRealAgents ?? false} />
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {running} ACTIVE
            </span>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Running" value={running} sub="right now" live />
          <MetricCard label="Idle" value={idle} sub="on standby" />
          <MetricCard label="Scheduled" value={scheduled} sub="upcoming" />
          <MetricCard label="Tasks Today" value={tasksToday.toLocaleString()} sub="completed" />
        </div>

        {/* Agent grid */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Autonomous Systems
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {agentsLoading && !hasRealAgents
              ? Array.from({ length: 4 }).map((_, i) => <AgentCardSkeleton key={i} />)
              : agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onToggle={handleToggle}
                    pulsing={
                      pulsingJobId !== null &&
                      (agent.status === "running" ||
                        agent.name.toLowerCase().includes("scanner") ||
                        agent.name.toLowerCase().includes("watcher"))
                    }
                  />
                ))}
          </div>
        </div>

        {/* Performance summary bar */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              System Performance
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-bold text-foreground tabular-nums leading-none">
                  {agents.reduce((sum, a) => sum + a.tasksCompleted, 0).toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Total Tasks Run</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-bold text-foreground tabular-nums leading-none">
                  {Math.round(agents.reduce((sum, a) => sum + a.successRate, 0) / Math.max(agents.length, 1))}%
                </span>
                <span className="text-[11px] font-medium text-emerald-500 flex items-center gap-0.5">
                  <TrendingUp className="h-2.5 w-2.5" />
                  avg
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Avg Success Rate</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-bold text-foreground tabular-nums leading-none">
                  {running}
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[11px] text-muted-foreground">Concurrent Runs</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-bold text-foreground tabular-nums leading-none">
                  {hasRealAgents ? `${agentsData?.summary?.running ?? running}` : "98.6%"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {hasRealAgents ? "Running Now" : "Fleet Uptime"}
              </p>
            </div>
          </div>
        </div>

        {/* Execution log */}
        <ExecutionLog entries={displayLog} isLive={hasRealJobs ?? false} />

      </div>
    </div>
  );
}
