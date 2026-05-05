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
import {
  getPromptOutcomeMetrics,
  getUserFeedbackSignals,
  type PromptOutcomeMetricsRow,
  type CalibrationBucket,
} from "@/lib/firebase/db";
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

// Leaderboard: per promptId, sort versions DESC by avgAccuracyNorm and
// compute the delta to the next-best version. Only versions with at least
// some outcome data participate.
interface LeaderboardEntry {
  promptId: string;
  versions: Array<{
    version: string;
    avgAccuracyNorm: number | null;
    hitRate: number | null;
    avgCalibrationError: number | null;
    runs: number;
    deltaVsNext: number | null; // accuracy delta to the next-best version
  }>;
}

// v2.6 calibration curve. Dependency-free SVG: x = predicted confidence,
// y = realised accuracy. The y=x dashed line represents perfect calibration.
// Points to the right of perfect are overconfident; left are under.
function CalibrationCurve({
  buckets,
  bias,
}: {
  buckets: CalibrationBucket[];
  bias: number | null;
}) {
  const filled = buckets.filter((b) => b.count > 0);
  if (filled.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Not enough confidence/outcome pairs yet. Record more outcomes to populate the curve.
      </p>
    );
  }

  const W = 320;
  const H = 220;
  const PAD = 28;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;

  const px = (v: number) => PAD + v * innerW;
  const py = (v: number) => PAD + (1 - v) * innerH;

  const polyline = filled
    .map((b) => `${px(b.avgConfidence).toFixed(1)},${py(b.avgAccuracy).toFixed(1)}`)
    .join(" ");

  const biasPct = bias === null ? null : Math.round(bias * 100);
  const summary =
    biasPct === null
      ? "Calibration data is too thin to draw a verdict."
      : Math.abs(biasPct) < 3
      ? "You are well-calibrated — confidence tracks reality."
      : biasPct > 0
      ? `You are overconfident by +${biasPct}%.`
      : `You are underconfident by ${biasPct}%.`;

  return (
    <div className="space-y-2">
      <svg width={W} height={H} className="bg-muted/20 rounded">
        {/* Axis frame */}
        <rect x={PAD} y={PAD} width={innerW} height={innerH} fill="none" stroke="currentColor" strokeOpacity="0.15" />
        {/* y = x reference */}
        <line
          x1={px(0)} y1={py(0)} x2={px(1)} y2={py(1)}
          stroke="currentColor" strokeOpacity="0.35" strokeDasharray="4 4"
        />
        {/* Actual curve */}
        <polyline points={polyline} fill="none" stroke="currentColor" strokeOpacity="0.85" strokeWidth="2" />
        {/* Bucket points */}
        {filled.map((b, i) => (
          <circle
            key={i}
            cx={px(b.avgConfidence)}
            cy={py(b.avgAccuracy)}
            r={Math.min(8, 3 + Math.log2(b.count + 1))}
            fill="currentColor"
            fillOpacity="0.7"
          >
            <title>
              {`bucket ${b.range[0].toFixed(1)}–${b.range[1].toFixed(1)} · n=${b.count} · conf ${(b.avgConfidence * 100).toFixed(0)}% · acc ${(b.avgAccuracy * 100).toFixed(0)}%`}
            </title>
          </circle>
        ))}
        {/* Axis labels */}
        <text x={px(0)} y={H - 8} fontSize="9" fill="currentColor" fillOpacity="0.5">0</text>
        <text x={px(1) - 6} y={H - 8} fontSize="9" fill="currentColor" fillOpacity="0.5">1</text>
        <text x={4} y={py(1) + 3} fontSize="9" fill="currentColor" fillOpacity="0.5">1</text>
        <text x={4} y={py(0) + 3} fontSize="9" fill="currentColor" fillOpacity="0.5">0</text>
        <text x={W / 2} y={H - 2} fontSize="9" fill="currentColor" fillOpacity="0.5" textAnchor="middle">
          predicted confidence
        </text>
        <text
          x={10} y={H / 2}
          fontSize="9" fill="currentColor" fillOpacity="0.5"
          textAnchor="middle"
          transform={`rotate(-90 10 ${H / 2})`}
        >
          actual accuracy
        </text>
      </svg>
      <p className="text-xs text-foreground/80">{summary}</p>
    </div>
  );
}

function buildLeaderboard(rows: MergedRow[]): LeaderboardEntry[] {
  const byPrompt = new Map<string, MergedRow[]>();
  for (const r of rows) {
    if (!r.promptId || r.outcomeRuns === 0) continue;
    const list = byPrompt.get(r.promptId) ?? [];
    list.push(r);
    byPrompt.set(r.promptId, list);
  }

  return Array.from(byPrompt.entries())
    .map(([promptId, rs]) => {
      const sorted = [...rs].sort(
        (a, b) => (b.avgAccuracyNorm ?? -Infinity) - (a.avgAccuracyNorm ?? -Infinity)
      );
      return {
        promptId,
        versions: sorted.map((r, i) => {
          const next = sorted[i + 1];
          const delta =
            next && r.avgAccuracyNorm !== null && next.avgAccuracyNorm !== null
              ? r.avgAccuracyNorm - next.avgAccuracyNorm
              : null;
          return {
            version: r.promptVersion ?? "—",
            avgAccuracyNorm: r.avgAccuracyNorm,
            hitRate: r.hitRate,
            avgCalibrationError: r.avgCalibrationError,
            runs: r.outcomeRuns,
            deltaVsNext: delta,
          };
        }),
      };
    })
    .sort((a, b) => a.promptId.localeCompare(b.promptId));
}

export default function PromptHealthPage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<MergedRow[]>([]);
  const [sinceIso, setSinceIso] = React.useState<string | null>(null);
  const [rollbacks, setRollbacks] = React.useState<RollbackDecision[]>([]);
  const [calibrationBuckets, setCalibrationBuckets] = React.useState<CalibrationBucket[]>([]);
  const [calibrationBias, setCalibrationBias] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const [backendRes, outcomeResult, signals] = await Promise.all([
        fetch("/api/ai/internal/prompt-health", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        getPromptOutcomeMetrics(user.uid, 30),
        getUserFeedbackSignals(user.uid, 100),
      ]);
      const envelope = (await backendRes.json().catch(() => null)) as { ok?: boolean; data?: BackendData; error?: string } | null;
      if (!backendRes.ok || !envelope?.ok || !envelope.data) {
        throw new Error(envelope?.error || `Request failed (${backendRes.status})`);
      }
      setRows(mergeRows(envelope.data.rows, outcomeResult.rows));
      setSinceIso(envelope.data.sinceIso);
      setRollbacks(getRollbackDecisions());
      setCalibrationBuckets(signals.calibrationBuckets);
      setCalibrationBias(signals.calibrationBias);
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
                <span className="font-mono">v{r.fromVersion}</span> →{" "}
                <span className="font-mono">v{r.toVersion}</span>{" "}
                <span className="text-muted-foreground/70">
                  (recent {fmtPercent(r.recentAccuracy)} over {r.recentRuns} runs vs previous {fmtPercent(r.previousAccuracy)} over {r.previousRuns} runs)
                </span>
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

      {/* v2.6 Calibration curve — confidence vs reality. */}
      {(calibrationBuckets.length > 0 || calibrationBias !== null) && (
        <section className="mb-6 rounded border border-border p-4 bg-card">
          <h2 className="text-sm font-semibold mb-3">Calibration Curve</h2>
          <CalibrationCurve buckets={calibrationBuckets} bias={calibrationBias} />
        </section>
      )}

      {/* Leaderboard — versions ranked by accuracy per prompt */}
      {(() => {
        const board = buildLeaderboard(rows);
        if (board.length === 0) return null;
        return (
          <section className="mb-6 rounded border border-border p-4 bg-card">
            <h2 className="text-sm font-semibold mb-3">Leaderboard</h2>
            <div className="space-y-4">
              {board.map((entry) => (
                <div key={entry.promptId}>
                  <div className="font-mono text-xs text-foreground/80 mb-1.5">{entry.promptId}</div>
                  <ul className="space-y-1">
                    {entry.versions.map((v, i) => (
                      <li key={v.version} className="flex items-center gap-2 text-xs">
                        <span className="w-4 text-muted-foreground/50 tabular-nums">{i + 1}.</span>
                        <span className="font-mono text-foreground/85">v{v.version}</span>
                        <span className="tabular-nums text-foreground/70">→ {fmtPercent(v.avgAccuracyNorm)}</span>
                        {v.deltaVsNext !== null && v.deltaVsNext > 0 && (
                          <span className="tabular-nums text-success/80">
                            ({v.deltaVsNext >= 0 ? "+" : ""}{(v.deltaVsNext * 100).toFixed(0)}%)
                          </span>
                        )}
                        <span className="text-muted-foreground/50">·</span>
                        <span className="tabular-nums text-muted-foreground/70">hit {fmtPercent(v.hitRate)}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="tabular-nums text-muted-foreground/70">calib. err {fmtPercent(v.avgCalibrationError)}</span>
                        <span className="text-muted-foreground/40 ml-auto">{v.runs} runs</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

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
