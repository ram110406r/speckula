"use client";

import { useEffect } from "react";
import { useApi } from "./useApi";
import { useSpecklaBus } from "./useSpecklaBus";

export interface CompetitorInsight {
  id: string;
  domain: string;
  competitorName: string;
  insightType: string;
  title: string;
  content: string;
  evidence: Record<string, unknown> | null;
  sourceUrl: string | null;
  confidence: number;
  capturedAt: string;
}

export interface CompetitorSummary {
  domain: string;
  competitorName: string;
  insightTypes: string[];
  latestInsight: CompetitorInsight;
  totalInsights: number;
  lastCapturedAt: string;
}

export interface CompetitorsResponse {
  competitors: CompetitorSummary[];
}

export interface CompetitorChangesResponse {
  changes: CompetitorInsight[];
  total: number;
}

export function useCompetitors() {
  const { data, loading, error, refetch } = useApi<CompetitorsResponse>(
    '/api/competitors',
    { refreshInterval: 2 * 60_000 },
  );
  const { lastEvent } = useSpecklaBus();

  // Refetch when a new insight arrives via WebSocket.
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === 'insight.created') {
      refetch();
    }
  }, [lastEvent, refetch]);

  return { data, loading, error, refetch };
}

export function useCompetitorChanges(type?: string) {
  const url = type
    ? `/api/competitors/changes?type=${encodeURIComponent(type)}`
    : '/api/competitors/changes';

  const { data, loading, error, refetch } = useApi<CompetitorChangesResponse>(url, {
    refreshInterval: 2 * 60_000,
  });

  return { data, loading, error, refetch };
}
