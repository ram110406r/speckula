"use client";

import { useApi } from "./useApi";
import { useExtensionPreferences } from "./useExtensionPreferences";

export interface ExperimentSummary {
  id: string;
  title: string;
  status: string;
  verdict?: string;
  startedAt?: string | null;
  createdAt: string;
}

export interface ExperimentsResponse {
  experiments: ExperimentSummary[];
}

export function useExperiments() {
  const { preferences } = useExtensionPreferences();
  const activeWorkspaceId = preferences?.activeWorkspaceId ?? null;

  const url = activeWorkspaceId
    ? `/api/workspaces/${activeWorkspaceId}/experiments`
    : '/api/experiments';

  const { data, loading, error, refetch } = useApi<ExperimentsResponse>(url, {
    refreshInterval: 60_000, // Poll every minute
  });

  return { data, loading, error, refetch };
}
