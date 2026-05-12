"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";

export interface UseApiOptions {
  enabled?: boolean;          // skip fetch if false (default: true)
  refreshInterval?: number;  // poll every N ms; 0 or undefined = no polling
}

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(url: string, options: UseApiOptions = {}): UseApiResult<T> {
  const { enabled = true, refreshInterval } = options;
  const { user } = useAuth();

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // A counter bump forces the effect to re-run (manual refetch).
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refetch = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !user) {
      return;
    }

    let abortController = new AbortController();
    let cancelled = false;

    const doFetch = async () => {
      setLoading(true);
      setError(null);

      let token: string;
      try {
        token = await user.getIdToken();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to get auth token.');
          setLoading(false);
        }
        return;
      }

      if (cancelled) return;

      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal,
        });

        if (cancelled) return;

        if (!res.ok) {
          let errMsg = `Request failed: ${res.status} ${res.statusText}`;
          try {
            const body = await res.json() as { error?: string };
            if (body?.error) errMsg = body.error;
          } catch {
            // ignore JSON parse error — keep the HTTP status message
          }
          setError(errMsg);
          setData(null);
        } else {
          const json = await res.json() as unknown;
          if (cancelled) return;

          // Most backend routes respond with { ok: boolean, data?: T, error?: string }.
          if (json && typeof json === 'object' && 'ok' in json) {
            const env = json as { ok: boolean; data?: T; error?: string };
            if (env.ok) {
              setData((env.data ?? null) as T | null);
              setError(null);
            } else {
              setError(env.error ?? 'Request failed.');
              setData(null);
            }
          } else {
            setData(json as T);
            setError(null);
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Fetch failed.');
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    doFetch();

    // Set up interval polling if requested.
    if (refreshInterval && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        // Create a fresh AbortController for each poll cycle.
        abortController = new AbortController();
        doFetch();
      }, refreshInterval);
    }

    return () => {
      cancelled = true;
      abortController.abort();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled, user, tick, refreshInterval]);

  return { data, loading, error, refetch };
}
