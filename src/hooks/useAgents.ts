"use client";

import { useEffect } from "react";
import { useApi } from "./useApi";
import { useSpecklaBus } from "./useSpecklaBus";

export type AutonomyLevel = 'manual' | 'suggest' | 'auto';
export type MemoryScope = 'none' | 'agent' | 'workspace' | 'global';

export interface AgentStatus {
  id: string;
  key: string;
  name: string;
  role: string;
  objective: string | null;
  // Config
  modelName: string;
  temperature: number;
  autonomyLevel: AutonomyLevel;
  enabled: boolean;
  schedule: string | null;
  tokenBudget: number | null;
  maxRetries: number;
  memoryScope: MemoryScope;
  isDefault: boolean;
  lastRunAt: string | null;
  // Live stats
  status: 'running' | 'idle' | 'disabled';
  runningJobs: number;
  queuedJobs: number;
  completedTotal: number;
  failedTotal: number;
  lastActivity: string | null;
}

export interface AgentsResponse {
  agents: AgentStatus[];
  summary: { total: number; enabled: number; running: number; queued: number; completed: number; failed: number };
}

export interface AgentJob {
  id: string;
  status: string;
  progress: number;
  pageType: string | null;
  sourceUrl: string | null;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface AgentJobsResponse {
  jobs: AgentJob[];
  total: number;
}

export function useAgents() {
  const { data, loading, error, refetch } = useApi<AgentsResponse>(
    '/api/agents',
    { refreshInterval: 30_000 },
  );
  const { lastEvent } = useSpecklaBus();

  // Refetch on job completion or progress events for live feel.
  useEffect(() => {
    if (!lastEvent) return;
    if (
      lastEvent.type === 'analysis.completed' ||
      lastEvent.type === 'analysis.progress'
    ) {
      refetch();
    }
  }, [lastEvent, refetch]);

  return { data, loading, error, refetch };
}

export function useAgentJobs(status?: string) {
  const url = status
    ? `/api/agents/jobs?status=${encodeURIComponent(status)}`
    : '/api/agents/jobs';

  const { data, loading, error, refetch } = useApi<AgentJobsResponse>(url, {
    refreshInterval: 30_000,
  });

  return { data, loading, error, refetch };
}

export interface AgentHistoryResponse {
  dailyTrend: { date: string; queued: number; completed: number; failed: number }[];
  byStatus: Record<string, number>;
}

export function useAgentHistory() {
  const { data, loading, error, refetch } = useApi<AgentHistoryResponse>(
    '/api/agents/history',
    { refreshInterval: 60_000 },
  );
  return { data, loading, error, refetch };
}

export type AgentVerdict = 'PROCEED' | 'VALIDATE_FIRST' | 'DO_NOT_BUILD';

export interface AgentRunSummary {
  id: string;
  idea: string;
  depth: 'quick' | 'standard' | 'deep';
  status: 'running' | 'completed' | 'stopped' | 'failed';
  currentStep: string | null;
  verdict: AgentVerdict | null;
  verdictReason: string | null;
  tokensUsed: number;
  durationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface AgentRunsResponse {
  runs: AgentRunSummary[];
}

export function useAgentRuns(status?: string) {
  const url = status
    ? `/api/agent-runs?status=${encodeURIComponent(status)}`
    : '/api/agent-runs';

  const { data, loading, error, refetch } = useApi<AgentRunsResponse>(url, {
    refreshInterval: 30_000,
  });
  const { lastEvent } = useSpecklaBus();

  useEffect(() => {
    if (!lastEvent) return;
    if (
      lastEvent.type === 'agent.completed' ||
      lastEvent.type === 'agent.started' ||
      lastEvent.type === 'agent.stopped'
    ) {
      refetch();
    }
  }, [lastEvent, refetch]);

  return { data, loading, error, refetch };
}

export interface AgentRunStats {
  total: number;
  last30Days: number;
  verdicts: Partial<Record<AgentVerdict, number>>;
  avgDurationMs: number;
  totalTokensLast30d: number;
}

export function useAgentRunStats() {
  const { data, loading, error, refetch } = useApi<AgentRunStats>(
    '/api/agent-runs/stats',
    { refreshInterval: 60_000 },
  );
  const { lastEvent } = useSpecklaBus();

  useEffect(() => {
    if (lastEvent?.type === 'agent.completed') refetch();
  }, [lastEvent, refetch]);

  return { data, loading, error, refetch };
}

export interface AgentRunDetail extends AgentRunSummary {
  steps: { step: string; ts: string; payload?: unknown }[] | null;
  clarifications: string[] | null;
  decisions: unknown[] | null;
  strategy: unknown | null;
  roadmap: unknown[] | null;
}

export function useAgentRun(id: string | null) {
  const { data, loading, error, refetch } = useApi<{ run: AgentRunDetail }>(
    id ? `/api/agent-runs/${encodeURIComponent(id)}` : '/api/agent-runs/__none__',
    { enabled: !!id },
  );
  return { run: data?.run ?? null, loading, error, refetch };
}
