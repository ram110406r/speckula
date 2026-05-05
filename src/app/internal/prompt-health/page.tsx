"use client";

// Dev-only prompt health dashboard. Aggregates the last 14 days of PromptLog
// rows by (promptId, promptVersion) — cost / latency / tokens — and merges
// with Firestore outcome metrics — accuracy / hit rate / calibration —
// computed locally from the user's saved decisions.
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
import { getPromptOutcomeMetrics, type PromptOutcomeMetricsRow } from "@/lib/firebase/db";
import { getRollbackDecisions, type RollbackDecision } from "@/lib/ai/promptLibrary";

interface BackendRow {
  promptId: string | null;
  promptVersion: string | null;
  usageCount: number;
  avgLatencyMs: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
}

interface BackendData {
  sinceIso: string;
  rows: BackendRow[];
}

interface MergedRow extends BackendRow {
  outcomeRuns: number;
  avgAccuracyNorm: number | null;
  hitRate: number | null;
  avgCalibrationError: number | null;
}

const IS_DEV = process.env.NODE_ENV !== "production";

function mergeRows(backend: BackendRow[], outcomes: PromptOutcomeMetricsRow[]): MergedRow[] {
  const outcomeIndex = new Map<string, PromptOutcomeMetricsRow>();
  for (const o of outcomes) outcomeIndex.set(`${o.promptId}::${o.promptVersion}`, o);

  const merged: MergedRow[] = backend.map((b) => {
    const o = b.promptId && b.promptVersion ? outcomeIndex.get(`${b.promptId}::${b.promptVersion}`) : undefined;
    return {
      ...b,
      outcomeRuns: o?.runs ?? 0,
      avgAccuracyNorm: o?.avgAccuracyNorm ?? null,
      hitRate: o?.hitRate ?? null,
      avgCalibrationError: o?.avgCalibrationError ?? null,
    };
  });

  // Surface outcome-only rows (decisions whose calls happened before the
  // backend log started recording the new fields).
  const seen = new Set(backend.map((b) => `${b.promptId}::${b.promptVersion}`));
  for (const o of outcomes) {
    const key = `${o.promptId}::${o.promptVersion}`;
    if (seen.has(key)) continue;
    merged.push({
      promptId: o.promptId,
      promptVersion: o.promptVersion,
      usageCount: 0,
      avgLatencyMs: 0,
      avgInputTokens: 0,
      avgOutputTokens: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      outcomeRuns: o.runs,
      avgAccuracyNorm: o.avgAccuracyNorm,
      hitRate: o.hitRate,
      avgCalibrationError: o.avgCalibrationError,
    });
  }

  return merged.sort((a, b) => {
    const idCmp = (a.promptId ?? "").localeCompare(b.promptId ?? "");
    if (idCmp !== 0) return idCmp;
    return (a.promptVersion ?? "").localeCompare(b.promptVersion ?? "");
  });
}

function fmtPercent(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(0)}%`;
}

export default function PromptHealthPage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<MergedRow[]>([]);
  const [sinceIso, setSinceIso] = React.useState<string | null>(null);
  const [rollbacks, setRollbacks] = React.useState<RollbackDecision[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const [backendRes, outcomeRows] = await Promise.all([
        fetch("/api/ai/internal/prompt-health", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        getPromptOutcomeMetrics(user.uid, 30),
      ]);
      const envelope = (await backendRes.json().catch(() => null)) as { ok?: boolean; data?: BackendData; error?: string } | null;
      if (!backendRes.ok || !envelope?.ok || !envelope.data) {
        throw new Error(envelope?.error || `Request failed (${backendRes.status})`);
      }
      setRows(mergeRows(envelope.data.rows, outcomeRows));
      setSinceIso(envelope.data.sinceIso);
      setRollbacks(getRollbackDecisions());
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
    <main className="p-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">Prompt Health</h1>
          <p className="text-xs text-muted-foreground">
            Cost / latency from PromptLog · accuracy from saved decisions ·{" "}
            {sinceIso ? new Date(sinceIso).toLocaleDateString() : "—"} → today
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

      {rollbacks.length > 0 && (
        <div className="rounded border border-warning/30 bg-warning/5 p-3 mb-4 text-xs">
          <div className="font-mono uppercase tracking-wide text-warning mb-1">Active rollbacks</div>
          <ul className="space-y-1">
            {rollbacks.map((r) => (
              <li key={r.promptId} className="text-foreground/80">
                <span className="font-mono">{r.promptId}</span>: rolled back from{" "}
                <span className="font-mono">v{r.fromVersion}</span> (acc {fmtPercent(r.pinnedAccuracy)}, {r.pinnedRuns} runs) →{" "}
                <span className="font-mono">v{r.toVersion}</span> (acc {fmtPercent(r.rollbackAccuracy)}, {r.rollbackRuns} runs)
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">
          No prompts logged with registry metadata yet. Run the autonomous agent to populate.
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Prompt ID</th>
                <th className="text-left px-3 py-2 font-medium">Version</th>
                <th className="text-right px-3 py-2 font-medium">Calls</th>
                <th className="text-right px-3 py-2 font-medium">Avg latency</th>
                <th className="text-right px-3 py-2 font-medium">Avg in tok</th>
                <th className="text-right px-3 py-2 font-medium">Avg out tok</th>
                <th className="text-right px-3 py-2 font-medium">Total tok</th>
                <th className="text-right px-3 py-2 font-medium">Cost</th>
                <th className="text-right px-3 py-2 font-medium">Outcomes</th>
                <th className="text-right px-3 py-2 font-medium">Avg accuracy</th>
                <th className="text-right px-3 py-2 font-medium">Hit rate</th>
                <th className="text-right px-3 py-2 font-medium">Avg calib. err</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{row.promptId ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{row.promptVersion ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.usageCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.avgLatencyMs} ms</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.avgInputTokens}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.avgOutputTokens}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.totalTokens.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${row.totalCostUsd.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.outcomeRuns}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPercent(row.avgAccuracyNorm)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPercent(row.hitRate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPercent(row.avgCalibrationError)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
