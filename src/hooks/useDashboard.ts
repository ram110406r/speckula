"use client";

import { useEffect } from "react";
import { useApi } from "./useApi";
import { useSpecklaBus } from "./useSpecklaBus";

export interface DashboardOverview {
  totalSignals: number;
  extensionSignals: number;
  weeklyCaptures: number;
  competitorInsights: number;
  marketSignals: number;
  productBrainTotal: number;
  aiJobsCompleted: number;
  aiJobsFailed: number;
  topDomains: { domain: string; count: number }[];
  extension: {
    connected: boolean;
    lastSeenAt: string | null;
    // Backend may use either naming convention — support both.
    extensionVersion: string | null;
    version?: string | null;
    browserType: string | null;
    browser?: string | null;
  };
  realtimeConnections: number;
  recentActivity: {
    // Support both old and new backend shapes.
    id?: unknown;
    action?: string;
    type?: string;
    resourceType?: string;
    description?: string;
    at?: string;
    createdAt?: string;
    category?: string;
  }[];
}

export function useDashboard() {
  const { data, loading, error, refetch } = useApi<DashboardOverview>(
    '/api/analytics/overview',
    { refreshInterval: 30_000 },
  );
  const { lastEvent } = useSpecklaBus();

  // Refetch when relevant WebSocket events arrive.
  useEffect(() => {
    if (!lastEvent) return;
    if (
      ['analysis.completed', 'insight.created', 'notification.created'].includes(lastEvent.type)
    ) {
      refetch();
    }
  }, [lastEvent, refetch]);

  return { data, loading, error, refetch };
}
