"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "./useApi";
import { useSpecklaBus } from "./useSpecklaBus";
import { useAuth } from "@/lib/firebase/AuthProvider";

export interface ProductBrainEntry {
  id: string;
  entryType: string; // competitor_insight|market_signal|pm_insight|pricing_observation|onboarding_pattern|feature_comparison|strategic_decision|ux_friction
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  sourceUrl: string | null;
  confidence: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductBrainResponse {
  entries: ProductBrainEntry[];
  total: number;
  byType: Record<string, number>;
}

export function useProductBrain(entryType?: string, search?: string) {
  const { user } = useAuth();
  const { lastEvent } = useSpecklaBus();

  // Search mode: POST /api/product-brain/search with { q: search }
  const [searchData, setSearchData] = useState<ProductBrainResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchTick, setSearchTick] = useState(0);

  const runSearch = useCallback(() => {
    setSearchTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!search || !user) return;

    let cancelled = false;

    const doSearch = async () => {
      setSearchLoading(true);
      setSearchError(null);

      let token: string;
      try {
        token = await user.getIdToken();
      } catch (err) {
        if (!cancelled) {
          setSearchError(err instanceof Error ? err.message : 'Failed to get auth token.');
          setSearchLoading(false);
        }
        return;
      }

      if (cancelled) return;

      try {
        const res = await fetch('/api/product-brain/search', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ q: search }),
        });

        if (cancelled) return;

        if (!res.ok) {
          let errMsg = `Request failed: ${res.status} ${res.statusText}`;
          try {
            const body = await res.json() as { error?: string };
            if (body?.error) errMsg = body.error;
          } catch {
            // keep HTTP status message
          }
          setSearchError(errMsg);
          setSearchData(null);
        } else {
          const json = await res.json() as ProductBrainResponse;
          if (!cancelled) {
            setSearchData(json);
            setSearchError(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setSearchError(err instanceof Error ? err.message : 'Search failed.');
          setSearchData(null);
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    };

    doSearch();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, user, searchTick]);

  // GET mode: /api/product-brain/entries?entryType=...&limit=20
  const getUrl = (() => {
    const params = new URLSearchParams({ limit: '20' });
    if (entryType) params.set('entryType', entryType);
    return `/api/product-brain/entries?${params.toString()}`;
  })();

  const {
    data: getData,
    loading: getLoading,
    error: getError,
    refetch: getRefetch,
  } = useApi<ProductBrainResponse>(getUrl, {
    enabled: !search,
  });

  // Refetch on new insight events.
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === 'insight.created') {
      if (search) {
        runSearch();
      } else {
        getRefetch();
      }
    }
  }, [lastEvent, search, runSearch, getRefetch]);

  if (search) {
    return {
      data: searchData,
      loading: searchLoading,
      error: searchError,
      refetch: runSearch,
    };
  }

  return {
    data: getData,
    loading: getLoading,
    error: getError,
    refetch: getRefetch,
  };
}
