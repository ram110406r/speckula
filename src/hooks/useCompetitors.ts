"use client";

import { useEffect, useCallback, useState } from "react";
import { useApi } from "./useApi";
import { useSpecklaBus } from "./useSpecklaBus";
import { useAuth } from "@/lib/firebase/AuthProvider";

export interface CompetitorInsight {
  id:           string;
  domain:       string;
  competitorName: string;
  insightType:  string;
  title:        string;
  content:      string;
  evidence:     string | null;   // JSON-encoded string[] stored by the backend
  sourceUrl:    string | null;
  confidence:   number;
  capturedAt:   string;
}

export interface CompetitorSummary {
  domain:         string;
  competitorName: string | null;
  insightTypes:   string[];
  latestInsight:  CompetitorInsight | null;
  totalInsights:  number;
  lastCapturedAt: string | null;
  status:         'queued' | 'completed' | 'failed';
}

export interface CompetitorsResponse {
  competitors: CompetitorSummary[];
}

export interface CompetitorChangesResponse {
  changes: CompetitorInsight[];
  total:   number;
}

/** Safely parse the JSON-encoded evidence string stored in the backend. */
export function parseEvidence(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === 'string') : [];
  } catch {
    return [];
  }
}

const COMPETITOR_EVENTS = new Set([
  'competitor.insight.created',
  'competitor.updated',
  'competitor.added',
]);

export function useCompetitors() {
  const { data, loading, error, refetch } = useApi<CompetitorsResponse>(
    '/api/competitors',
    { refreshInterval: 2 * 60_000 },
  );
  const { lastEvent } = useSpecklaBus();

  // Refetch only on competitor-scoped events — not on every Product Brain insight.
  useEffect(() => {
    if (!lastEvent) return;
    if (COMPETITOR_EVENTS.has(lastEvent.type)) {
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
  const { lastEvent } = useSpecklaBus();

  useEffect(() => {
    if (!lastEvent) return;
    if (COMPETITOR_EVENTS.has(lastEvent.type)) {
      refetch();
    }
  }, [lastEvent, refetch]);

  return { data, loading, error, refetch };
}

export interface AddCompetitorResult {
  ok:              boolean;
  alreadyTracking?: boolean;
  error?:          string;
}

export function useAddCompetitor() {
  const { user } = useAuth();
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);

  const add = useCallback(async (url: string): Promise<AddCompetitorResult> => {
    setLoading(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/competitors', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });

      const json = await res.json() as {
        ok: boolean;
        data?: { domain: string; status: string; alreadyTracking: boolean };
        error?: string;
      };

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Request failed (${res.status})`);
      }
      return { ok: true, alreadyTracking: json.data?.alreadyTracking };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add competitor';
      setError(message);
      return { ok: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  const clearError = useCallback(() => setError(null), []);

  return { add, loading, error, clearError };
}
