"use client";

import React from "react";
import {
  Puzzle, Sparkles, MousePointerClick, Highlighter, Brain, Layers,
  WifiOff, Building2, Copy, Check, RefreshCw, CheckCircle2, XCircle,
  Clock, Activity, Loader2, Settings as SettingsIcon, Inbox, KeyRound,
} from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToastStore";
import { useExtensionStatus, useExtensionStats, type ExtensionConnectionStatus } from "@/hooks/useExtension";
import { useAgentJobs } from "@/hooks/useAgents";

// ── helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

const STATUS_META: Record<ExtensionConnectionStatus, { label: string; dot: string; text: string }> = {
  connected:     { label: "Connected",     dot: "bg-success animate-pulse",   text: "text-success" },
  reconnecting:  { label: "Reconnecting",  dot: "bg-warning animate-pulse",   text: "text-warning" },
  disconnected:  { label: "Disconnected",  dot: "bg-destructive",             text: "text-destructive" },
  not_installed: { label: "Not installed", dot: "bg-muted-foreground/40",     text: "text-muted-foreground" },
};

const CAPABILITIES: { icon: React.ElementType; title: string; sub: string }[] = [
  { icon: MousePointerClick, title: "One-click capture", sub: "Capture any page and queue it for AI analysis." },
  { icon: Highlighter,       title: "Context-menu capture", sub: "Right-click selected text to capture a snippet." },
  { icon: Brain,             title: "Auto-classify", sub: "Captures are classified and synced to your Product Brain." },
  { icon: Layers,            title: "Batch workflows", sub: "Analyze multiple pages in a single batch run." },
  { icon: WifiOff,           title: "Offline queue", sub: "Captures made offline queue and sync on reconnect." },
  { icon: Building2,         title: "Workspace-aware", sub: "Routes captures to your active workspace with quota tracking." },
];

const JOB_RUNNING = new Set(["extracting", "classifying", "generating_insights", "embedding", "saving"]);

function jobTone(status: string): { color: string; icon: React.ElementType } {
  if (status === "completed") return { color: "text-success", icon: CheckCircle2 };
  if (status === "failed")    return { color: "text-destructive", icon: XCircle };
  if (status === "queued")    return { color: "text-warning", icon: Clock };
  if (JOB_RUNNING.has(status)) return { color: "text-primary", icon: Loader2 };
  return { color: "text-muted-foreground", icon: Activity };
}

// ── small components ───────────────────────────────────────────────────────

function MetricCard({ label, value, tone = "text-foreground", icon: Icon }: {
  label: string; value: React.ReactNode; tone?: string; icon?: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground/60">
        {Icon && <Icon className="h-3 w-3" />}
        <span className="font-mono text-[9px] uppercase tracking-[0.08em]">{label}</span>
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">{children}</h2>
  );
}

// ── main view ────────────────────────────────────────────────────────────────

export function ExtensionView() {
  const { user } = useAuth();
  const setActiveView = useAppStore((s) => s.setActiveView);

  const { data: status, loading: statusLoading, refetch: refetchStatus } = useExtensionStatus();
  const { data: stats } = useExtensionStats();
  const { data: jobsData } = useAgentJobs();

  const [copied, setCopied] = React.useState(false);
  const [copying, setCopying] = React.useState(false);

  const connStatus: ExtensionConnectionStatus = status?.status ?? "not_installed";
  const meta = STATUS_META[connStatus];
  const installed = connStatus !== "not_installed";
  const version = status?.extensionVersion ?? stats?.extensionVersion ?? null;
  const jobs = (jobsData?.jobs ?? []).slice(0, 6);

  const copyToken = React.useCallback(async () => {
    if (!user) { toast.error("Sign in first"); return; }
    setCopying(true);
    try {
      const token = await user.getIdToken();
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success("Connection token copied", "Paste it into the extension's Settings");
    } catch {
      toast.error("Could not copy token");
    } finally {
      setCopying(false);
    }
  }, [user]);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-background">
      <div className="mx-auto max-w-5xl px-6 py-6 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card">
                <Puzzle className="h-5 w-5 text-primary" />
              </div>
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                <Sparkles className="h-2.5 w-2.5 text-primary-foreground" />
              </span>
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">Browser Extension</h1>
              <p className="text-xs text-muted-foreground/70">
                Capture signals from any page — classified and synced to your Product Brain
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[10px] ${meta.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}{version ? ` · v${version}` : ""}
            </span>
            <button type="button" onClick={() => refetchStatus()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
        </div>

        {/* Connection banner */}
        {installed && (
          <div className={`rounded-xl border px-4 py-3 ${
            connStatus === "connected" ? "border-success/30 bg-success/5"
            : connStatus === "reconnecting" ? "border-warning/30 bg-warning/5"
            : "border-destructive/30 bg-destructive/5"
          }`}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className={`font-medium ${meta.text}`}>{meta.label}</span>
              {status?.browserType && <span className="text-muted-foreground/70">{status.browserType}</span>}
              {version && <span className="font-mono text-muted-foreground/60">v{version}</span>}
              <span className="text-muted-foreground/60">Last seen {relativeTime(status?.lastSeenAt)}</span>
            </div>
          </div>
        )}

        {/* Connect + token */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <SectionLabel>{installed ? "Reconnect" : "Connect the extension"}</SectionLabel>
            <ol className="space-y-3">
              {[
                "Install the SPECKULA extension in your browser (Chrome or Edge).",
                "Open the extension popup → Settings, and paste your connection token.",
                "Browse — capture pages with one click or the right-click menu.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-xs leading-relaxed text-foreground/80">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground/70">
              <KeyRound className="h-3.5 w-3.5" />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em]">Connection token</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/70">
              Copy your token and paste it into the extension&apos;s Settings to link this account.
            </p>
            <button type="button" onClick={copyToken} disabled={copying || !user}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 font-mono text-[11px] font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40">
              {copying ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : copied ? <Check className="h-3.5 w-3.5" />
                : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied to clipboard" : "Copy connection token"}
            </button>
            <p className="mt-2 font-mono text-[9px] text-muted-foreground/50">
              Token is valid for ~1 hour. Re-copy if the extension shows it expired.
            </p>
            <button type="button" onClick={() => setActiveView("settings")}
              className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              <SettingsIcon className="h-3 w-3" /> Manage preferences in Settings
            </button>
          </div>
        </section>

        {/* Capabilities */}
        <section className="space-y-3">
          <SectionLabel>What it does</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map(({ icon: Icon, title, sub }) => (
              <div key={title} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-2.5 text-sm font-medium text-foreground">{title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/70">{sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats — only meaningful once installed/captured */}
        {(installed || (stats?.totalJobs ?? 0) > 0) && (
          <section className="space-y-3">
            <SectionLabel>Capture activity</SectionLabel>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Total captures" value={stats?.totalJobs ?? 0} icon={Activity} />
              <MetricCard label="Completed"      value={stats?.completedJobs ?? 0} tone="text-success" icon={CheckCircle2} />
              <MetricCard label="Failed"         value={stats?.failedJobs ?? 0} tone={(stats?.failedJobs ?? 0) > 0 ? "text-destructive" : "text-muted-foreground/60"} icon={XCircle} />
              <MetricCard label="Last 7 days"    value={stats?.jobsLast7Days ?? 0} tone="text-primary" icon={Clock} />
            </div>

            <div className="rounded-xl border border-border bg-card">
              {jobs.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-10 text-center">
                  <Inbox className="h-5 w-5 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground/50">No captures yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {jobs.map((j) => {
                    const tone = jobTone(j.status);
                    const Icon = tone.icon;
                    const spinning = JOB_RUNNING.has(j.status);
                    const label = j.sourceUrl ? j.sourceUrl.replace(/^https?:\/\//, "").slice(0, 56) : (j.pageType ?? "capture");
                    return (
                      <div key={j.id} className="flex items-center gap-3 px-4 py-2.5">
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${tone.color} ${spinning ? "animate-spin" : ""}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-foreground/90">{label}</p>
                          <p className="font-mono text-[9px] text-muted-foreground/50">
                            {j.status.replace(/_/g, " ")} · {relativeTime(j.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {statusLoading && !status && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking extension status…
          </div>
        )}
      </div>
    </div>
  );
}
