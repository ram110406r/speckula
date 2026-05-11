"use client";

import { useEffect } from "react";
import { useApi } from "./useApi";
import { useSpecklaBus } from "./useSpecklaBus";

export interface AgentStatus {
  name: string;
  type: string;
  status: 'running' | 'idle';
  runningJobs: number;
  queuedJobs: number;
  completedTotal: number;
  failedTotal: number;
  lastActivity: string | null;
}

export interface AgentsResponse {
  agents: AgentStatus[];
  summary: { running: number; queued: number; completed: number; failed: number };
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
    { refreshInterval: 10_000 },
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
    refreshInterval: 10_000,
  });

  return { data, loading, error, refetch };
}
