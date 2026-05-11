"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  Brain, TrendingUp, Cpu, CheckCircle2, XCircle,
  Wifi, WifiOff, Puzzle, Loader2, BarChart3,
} from "lucide-react";

interface OverviewData {
  totalSignals: number;
  weeklyCaptures: number;
  competitorInsights: number;
  marketSignals: number;
  aiJobsCompleted: number;
  aiJobsFailed: number;
  topDomains: { domain: string; count: number }[];
  extension: { connected: boolean; lastSeenAt: string | null; extensionVersion: string | null; browserType: string | null };
  realtimeConnections: number;
  recentActivity: { action: string; resourceType: string; at: string }[];
}

function StatCard({ label, value, sub, icon: Icon, accent = false }: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${accent ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${accent ? "bg-primary/15" : "bg-muted"}`}>
          <Icon className={`h-3.5 w-3.5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
        </div>
      </div>
      <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function RelativeTime({ iso }: { iso: string }) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return <>just now</>;
  if (m < 60) return <>{m}m ago</>;
  const h = Math.floor(m / 60);
  if (h < 24) return <>{h}h ago</>;
  return <>{Math.floor(h / 24)}d ago</>;
}

export function DashboardView() {
  const { user } = useAuth();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    user.getIdToken()
      .then((token) =>
        fetch("/api/analytics/overview", {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json())
      )
      .then((d) => {
        if (cancelled) return;
        if (d.ok) setData(d.data);
        else setError(d.error ?? "Failed to load");
      })
      .catch(() => { if (!cancelled) setError("Backend unreachable"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <XCircle className="h-8 w-8 text-destructive/60 mx-auto" />
          <p className="text-sm text-muted-foreground">{error ?? "No data"}</p>
        </div>
      </div>
    );
  }

  const successRate = data.aiJobsCompleted + data.aiJobsFailed > 0
    ? Math.round((data.aiJobsCompleted / (data.aiJobsCompleted + data.aiJobsFailed)) * 100)
    : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
            <p className="text-xs text-muted-foreground">Product intelligence at a glance</p>
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Signals"      value={data.totalSignals}      icon={Brain}       accent />
          <StatCard label="This Week"          value={data.weeklyCaptures}    icon={TrendingUp}  sub="new captures" />
          <StatCard label="AI Jobs"            value={data.aiJobsCompleted}   icon={Cpu}         sub={`${successRate}% success rate`} />
          <StatCard label="Competitor Domains" value={data.competitorInsights}icon={CheckCircle2}/>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Extension status */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Extension</span>
              <span className={`flex items-center gap-1.5 text-[11px] font-medium ${data.extension.connected ? "text-emerald-500" : "text-muted-foreground"}`}>
                {data.extension.connected
                  ? <><Wifi className="h-3 w-3" /> Connected</>
                  : <><WifiOff className="h-3 w-3" /> Offline</>
                }
              </span>
            </div>
            {data.extension.extensionVersion && (
              <div className="flex items-center gap-2">
                <Puzzle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">v{data.extension.extensionVersion} · {data.extension.browserType ?? "Browser"}</span>
              </div>
            )}
            {data.extension.lastSeenAt && (
              <p className="text-[11px] text-muted-foreground">
                Last seen <RelativeTime iso={data.extension.lastSeenAt} />
              </p>
            )}
            {!data.extension.lastSeenAt && (
              <p className="text-[11px] text-muted-foreground/50">Never connected</p>
            )}
          </div>

          {/* Top competitors */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Top Tracked Domains</span>
            {data.topDomains.length > 0 ? (
              <ul className="space-y-2">
                {data.topDomains.map((d) => (
                  <li key={d.domain} className="flex items-center justify-between">
                    <span className="text-[12px] text-foreground truncate">{d.domain}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{d.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground/50">No competitor data yet</p>
            )}
          </div>
        </div>

        {/* Recent activity */}
        {data.recentActivity.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent Activity</span>
            </div>
            <ul>
              {data.recentActivity.map((a, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 last:border-0">
                  <span className="text-[12px] text-foreground capitalize">{a.action.replace(/_/g, " ")} <span className="text-muted-foreground">· {a.resourceType}</span></span>
                  <span className="text-[11px] text-muted-foreground shrink-0 ml-3"><RelativeTime iso={a.at} /></span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
