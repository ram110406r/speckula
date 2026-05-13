"use client";

import { useEffect } from "react";
import { useApi } from "./useApi";
import { useSpecklaBus } from "./useSpecklaBus";

export interface MarketSignalData {
  id: string;
  signalType: string; // 'trend'|'competitor_move'|'market_shift'|'customer_feedback'|'pricing_change'|'feature_launch'
  title: string;
  content: string;
  sourceUrl: string | null;
  strength: number; // 0-1
  tags: string[];
  detectedAt: string;
  createdAt: string;
}

export interface MarketSignalsResponse {
  signals: MarketSignalData[];
  nextCursor: string | null;
  total: number;
}

export interface MarketTrendsResponse {
  byType: { type: string; count: number; avgStrength: number }[];
  recentHighStrength: MarketSignalData[];
}

export function useMarketSignals(type?: string) {
  const url = type
    ? `/api/market/signals?type=${encodeURIComponent(type)}`
    : '/api/market/signals';

  const { data, loading, error, refetch } = useApi<MarketSignalsResponse>(url, {
    refreshInterval: 60_000,
  });
  const { lastEvent } = useSpecklaBus();

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === 'insight.created') {
      refetch();
    }
  }, [lastEvent, refetch]);

  return { data, loading, error, refetch };
}

export function useMarketTrends() {
  const { data, loading, error, refetch } = useApi<MarketTrendsResponse>(
    '/api/market/trends',
    { refreshInterval: 5 * 60_000 },
  );

  return { data, loading, error, refetch };
}

export interface MarketOpportunityData {
  id: string;
  entryType: string; // 'pm_insight' | 'strategic_decision'
  title: string;
  content: string;
  confidence: number; // 0-1
  sourceUrl: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MarketOpportunitiesResponse {
  opportunities: MarketOpportunityData[];
}

export function useMarketOpportunities() {
  const { data, loading, error, refetch } = useApi<MarketOpportunitiesResponse>(
    '/api/market/opportunities',
    { refreshInterval: 5 * 60_000 },
  );

  return { data, loading, error, refetch };
}
