"use client";

import { useEffect } from "react";
import { useApi } from "./useApi";
import { useSpecklaBus } from "./useSpecklaBus";

export type ExtensionConnectionStatus =
  | "not_installed"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface ExtensionStatus {
  status: ExtensionConnectionStatus;
  extensionVersion?: string;
  browserType?: string;
  lastSeenAt?: string;
  workspaceId?: string | null;
  msSinceHeartbeat?: number;
}

// Backend caps /extension/* at 60 req/hr (1/min), so poll gently and rely on
// the WebSocket extension.connected/disconnected events for immediacy.
export function useExtensionStatus() {
  const { data, loading, error, refetch } = useApi<ExtensionStatus>(
    "/api/extension/status",
    { refreshInterval: 120_000 },
  );
  const { lastEvent } = useSpecklaBus();

  useEffect(() => {
    if (!lastEvent) return;
    if (
      lastEvent.type === "extension.connected" ||
      lastEvent.type === "extension.disconnected"
    ) {
      refetch();
    }
  }, [lastEvent, refetch]);

  return { data, loading, error, refetch };
}

export interface ExtensionStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  jobsLast7Days: number;
  lastSeen: string | null;
  extensionVersion: string | null;
}

export function useExtensionStats() {
  const { data, loading, error, refetch } = useApi<ExtensionStats>(
    "/api/extension/stats",
    { refreshInterval: 300_000 },
  );
  const { lastEvent } = useSpecklaBus();

  useEffect(() => {
    if (lastEvent?.type === "analysis.completed") refetch();
  }, [lastEvent, refetch]);

  return { data, loading, error, refetch };
}
