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
