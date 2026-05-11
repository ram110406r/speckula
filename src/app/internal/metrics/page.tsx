"use client";

// Founder-facing AI cost & usage dashboard.
// Accessible in all environments — protected by METRICS_TOKEN (X-Metrics-Token header).
// URL: /internal/metrics

import React from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";

interface DailyRow { date: string; requests: number; tokens: number; costUsd: number; }
interface ModelRow  { model: string; calls: number; tokens: number; costUsd: number; }
interface UserRow   { userId: string; tokens: number; requests: number; costUsd: number; }

interface MetricsData {
  period: { since: string; until: string };
  totals: { requests: number; tokens: number; costUsd: number; activeUsers: number };
  cacheRate: number;
  dailyTrend: DailyRow[];
  modelBreakdown: ModelRow[];
  topUsers: UserRow[];
  circuitBreaker: { state: string; failures: number; lastFailureAt: string | null };
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniBar({ pct, color = "bg-primary" }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function MetricsDashboard() {
  const { user } = useAuth();
  const [data, setData]       = React.useState<MetricsData | null>(null);
  const [error, setError]     = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [token, setToken]     = React.useState("");

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${idToken}` };
      if (token.trim()) headers["X-Metrics-Token"] = token.trim();

      const res = await fetch("/api/ai/internal/metrics", { headers });
      const envelope = await res.json().catch(() => null) as { ok?: boolean; data?: MetricsData; error?: string } | null;
      if (!res.ok || !envelope?.ok) {
        throw new Error(envelope?.error ?? `Request failed (${res.status})`);
      }
      setData(envelope.data!);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, [user, token]);

  if (!user) {
    return (
      <main className="p-8 max-w-3xl mx-auto">
        <h1 className="text-lg font-semibold mb-2">Metrics</h1>
        <p className="text-sm text-muted-foreground">Sign in to view the metrics dashboard.</p>
      </main>
    );
  }

  const maxTokensUser = data?.topUsers[0]?.tokens ?? 1;
  const maxDailyTokens = Math.max(...(data?.dailyTrend.map((d) => d.tokens) ?? [1]));

  const cbColor = data?.circuitBreaker.state === "closed"
    ? "text-green-600"
    : data?.circuitBreaker.state === "open"
    ? "text-red-600"
    : "text-amber-600";

  return (
    <main className="min-h-screen bg-background p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">AI Usage Metrics</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last 30 days · all users ·{" "}
            {data ? `${new Date(data.period.since).toLocaleDateString()} → ${new Date(data.period.until).toLocaleDateString()}` : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="password"
            placeholder="Metrics token (if set)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 w-48"
          />
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Loading…" : data ? "Refresh" : "Load"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive mb-6">
          {error}
        </div>
      )}

      {!data && !loading && (
        <p className="text-sm text-muted-foreground">Enter your metrics token and click Load.</p>
      )}

      {data && (
        <div className="space-y-8">
          {/* ── Totals ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Total requests"
              value={data.totals.requests.toLocaleString()}
              sub="30-day window"
            />
            <StatCard
              label="Total tokens"
              value={data.totals.tokens >= 1_000_000
                ? `${(data.totals.tokens / 1_000_000).toFixed(2)}M`
                : data.totals.tokens.toLocaleString()}
              sub="input + output"
            />
            <StatCard
              label="Estimated cost"
              value={`$${data.totals.costUsd.toFixed(2)}`}
              sub="USD · Groq pricing"
            />
            <StatCard
              label="Active users"
              value={data.totals.activeUsers.toLocaleString()}
              sub={`Cache hit ${(data.cacheRate * 100).toFixed(0)}%`}
            />
          </div>

          {/* ── Circuit breaker ── */}
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-2">Groq Circuit Breaker</h2>
            <div className="flex items-center gap-6 text-xs">
              <div>
                <span className="text-muted-foreground">State </span>
                <span className={`font-semibold capitalize ${cbColor}`}>{data.circuitBreaker.state}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Consecutive failures </span>
                <span className="font-semibold text-foreground">{data.circuitBreaker.failures}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Last failure </span>
                <span className="font-semibold text-foreground">
                  {data.circuitBreaker.lastFailureAt
                    ? new Date(data.circuitBreaker.lastFailureAt).toLocaleString()
                    : "never"}
                </span>
              </div>
            </div>
          </div>

          {/* ── Daily trend ── */}
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4">Daily Token Trend</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/60">
                    <th className="text-left pb-2 font-medium">Date</th>
                    <th className="text-right pb-2 font-medium">Requests</th>
                    <th className="text-right pb-2 font-medium pr-3">Tokens</th>
                    <th className="text-left pb-2 font-medium w-32">Share</th>
                    <th className="text-right pb-2 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dailyTrend.map((row) => (
                    <tr key={row.date} className="border-b border-border/30 last:border-0">
                      <td className="py-1.5 text-foreground font-mono">{row.date}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{row.requests.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums pr-3 text-foreground">{row.tokens.toLocaleString()}</td>
                      <td className="py-1.5 w-32">
                        <MiniBar pct={(row.tokens / maxDailyTokens) * 100} />
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">${row.costUsd.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Model breakdown ── */}
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4">Model Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/60">
                    <th className="text-left pb-2 font-medium">Model</th>
                    <th className="text-right pb-2 font-medium">Calls</th>
                    <th className="text-right pb-2 font-medium">Tokens</th>
                    <th className="text-right pb-2 font-medium">Cost (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.modelBreakdown.map((row) => (
                    <tr key={row.model} className="border-b border-border/30 last:border-0">
                      <td className="py-1.5 font-mono text-foreground">{row.model}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{row.calls.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums text-foreground">{row.tokens.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">${row.costUsd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Top users by token spend ── */}
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-1">Top Users by Token Spend</h2>
            <p className="text-[11px] text-muted-foreground mb-4">User IDs only — no PII exposed.</p>
            <div className="space-y-3">
              {data.topUsers.map((u, i) => (
                <div key={u.userId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-foreground/80 truncate max-w-[260px]">
                      {i + 1}. {u.userId}
                    </span>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground shrink-0">
                      <span>{u.requests.toLocaleString()} req</span>
                      <span>{u.tokens.toLocaleString()} tok</span>
                      <span className="text-foreground font-semibold">${u.costUsd.toFixed(3)}</span>
                    </div>
                  </div>
                  <MiniBar pct={(u.tokens / maxTokensUser) * 100} color="bg-amber-500" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
