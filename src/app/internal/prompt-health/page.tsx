"use client";

// Dev-only prompt health dashboard. Aggregates the last 14 days of PromptLog
// rows by (promptId, promptVersion) and renders a simple read-only table.
//
// Gated three ways:
//   1. process.env.NODE_ENV check at module load time — production builds
//      render a "not available" notice instead of the table.
//   2. Next.js dynamic route is server-rendered with no link from the main
//      app surface; users only land here by typing the URL.
//   3. The backend endpoint /ai/internal/prompt-health additionally rejects
//      production NODE_ENV, so a leaked URL still 404s in prod.

import React from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";

interface HealthRow {
  promptId: string | null;
  promptVersion: string | null;
  usageCount: number;
  avgLatencyMs: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
}

interface HealthData {
  sinceIso: string;
  rows: HealthRow[];
}

const IS_DEV = process.env.NODE_ENV !== "production";

export default function PromptHealthPage() {
  const { user } = useAuth();
  const [data, setData] = React.useState<HealthData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/ai/internal/prompt-health", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const envelope = (await res.json().catch(() => null)) as { ok?: boolean; data?: HealthData; error?: string } | null;
      if (!res.ok || !envelope?.ok || !envelope.data) {
        throw new Error(envelope?.error || `Request failed (${res.status})`);
      }
      setData(envelope.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load prompt health");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (IS_DEV && user) load();
  }, [user, load]);

  if (!IS_DEV) {
    return (
      <main className="p-8 max-w-3xl mx-auto">
        <h1 className="text-lg font-semibold mb-2">Prompt Health</h1>
        <p className="text-sm text-muted-foreground">
          This dashboard is disabled in production builds.
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="p-8 max-w-3xl mx-auto">
        <h1 className="text-lg font-semibold mb-2">Prompt Health</h1>
        <p className="text-sm text-muted-foreground">Sign in to view prompt aggregation.</p>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">Prompt Health</h1>
          <p className="text-xs text-muted-foreground">
            Per-prompt usage from the last 14 days · {data?.sinceIso ? new Date(data.sinceIso).toLocaleDateString() : "—"} → today
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 rounded border border-border bg-card hover:bg-muted text-xs font-mono disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive mb-4">
          {error}
        </div>
      )}

      {data && data.rows.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">
          No prompts logged with registry metadata yet. Run the autonomous agent to populate.
        </p>
      )}

      {data && data.rows.length > 0 && (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Prompt ID</th>
                <th className="text-left px-3 py-2 font-medium">Version</th>
                <th className="text-right px-3 py-2 font-medium">Usage</th>
                <th className="text-right px-3 py-2 font-medium">Avg latency</th>
                <th className="text-right px-3 py-2 font-medium">Avg in tokens</th>
                <th className="text-right px-3 py-2 font-medium">Avg out tokens</th>
                <th className="text-right px-3 py-2 font-medium">Total tokens</th>
                <th className="text-right px-3 py-2 font-medium">Total cost</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{row.promptId ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{row.promptVersion ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.usageCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.avgLatencyMs} ms</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.avgInputTokens}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.avgOutputTokens}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.totalTokens.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${row.totalCostUsd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
