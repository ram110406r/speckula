"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  MessageSquare,
  AlertTriangle,
  Zap,
  RefreshCw,
  Plus,
  XCircle,
  CheckCircle2,
  ArrowRight,
  Activity,
  Loader2,
  ChevronRight,
  Hash,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useApi } from "@/hooks/useApi";
import { useExtensionPreferences } from "@/hooks/useExtensionPreferences";
import {
  subscribeToSlackWorkspaces,
  type SlackWorkspace,
} from "@/lib/firebase/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityEntry {
  id: string;
  integration: string;
  action: string;
  detail: string;
  time: string;
}

interface BackendActivityItem {
  id: string;
  actorId: string;
  eventType: string;
  title: string;
  description: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(isoStr: string): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatFirestoreTimestamp(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts?.toDate) return "—";
  return formatRelativeTime(ts.toDate().toISOString());
}

function activityToEntry(item: BackendActivityItem): ActivityEntry {
  const lower = (item.eventType + " " + item.title).toLowerCase();
  const integration = lower.includes("slack") || lower.includes("digest") || lower.includes("alert")
    ? "Slack"
    : "SPECKULA";
  return {
    id: item.id,
    integration,
    action: item.title,
    detail: item.description ?? "",
    time: formatRelativeTime(item.createdAt),
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface WorkspaceCardProps {
  workspace: SlackWorkspace;
  onDisconnect: (teamId: string) => void;
  onBackfill: (teamId: string) => void;
  disconnecting: string | null;
  backfilling: string | null;
}

function WorkspaceCard({ workspace, onDisconnect, onBackfill, disconnecting, backfilling }: WorkspaceCardProps) {
  const isDisconnecting = disconnecting === workspace.teamId;
  const isBackfilling = backfilling === workspace.teamId;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-purple-500/10 text-purple-400 border-purple-500/20">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{workspace.teamName}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Slack
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Connected</span>
              {workspace.installedAt && (
                <span className="text-xs text-muted-foreground/60">· {formatFirestoreTimestamp(workspace.installedAt)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm" variant="outline" className="h-7 px-2 text-xs"
            onClick={() => onBackfill(workspace.teamId)}
            disabled={isBackfilling || isDisconnecting}
          >
            {isBackfilling
              ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              : <RefreshCw className="mr-1 h-3 w-3" />
            }
            {isBackfilling ? "Syncing…" : "Sync History"}
          </Button>
          <Button
            size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => onDisconnect(workspace.teamId)}
            disabled={isDisconnecting || isBackfilling}
          >
            {isDisconnecting
              ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              : <Unplug className="mr-1 h-3 w-3" />
            }
            {isDisconnecting ? "Disconnecting…" : "Disconnect"}
          </Button>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Receive intelligence alerts and weekly digests directly in your team channels.
        Messages are automatically ingested and analysed for signals.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {["Alerts", "Weekly digests", "Decision notifications", "Competitor alerts"].map((f) => (
          <span key={f} className="rounded-md border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">{f}</span>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {workspace.selectedChannels?.length ?? 0} channel{workspace.selectedChannels?.length !== 1 ? "s" : ""} configured
          </span>
          {workspace.backfillCompleted && (
            <span className="flex items-center gap-1 text-emerald-400/80">
              <CheckCircle2 className="h-3 w-3" />History synced
            </span>
          )}
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">On trigger</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function SlackView() {
  const { user } = useAuth();
  const { preferences } = useExtensionPreferences();
  const workspaceId = preferences?.activeWorkspaceId ?? null;

  const [slackWorkspaces, setSlackWorkspaces] = useState<SlackWorkspace[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Subscribe to real Slack workspace connections.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToSlackWorkspaces(user.uid, setSlackWorkspaces);
    return unsub;
  }, [user]);

  // Fetch workspace activity for the activity log.
  const { data: activityData, loading: activityLoading } = useApi<{ items: BackendActivityItem[] }>(
    workspaceId ? `/api/workspaces/${workspaceId}/activity?limit=20` : "",
    { enabled: Boolean(workspaceId), refreshInterval: 30_000 }
  );

  const activityLog: ActivityEntry[] = useMemo(() => {
    if (!activityData?.items?.length) return [];
    return activityData.items.map(activityToEntry);
  }, [activityData]);

  // Initiate real Slack OAuth flow.
  const handleConnect = async () => {
    if (!user || connecting) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/slack/install", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { ok: boolean; authorizeUrl?: string; error?: string };
      if (data.ok && data.authorizeUrl) {
        window.location.href = data.authorizeUrl;
      } else {
        setConnectError(data.error ?? "Failed to initiate Slack connection.");
        setConnecting(false);
      }
    } catch {
      setConnectError("Network error — please try again.");
      setConnecting(false);
    }
  };

  // Disconnect via real backend API (removes encrypted bot token).
  const handleDisconnect = async (teamId: string) => {
    if (!user || disconnecting) return;
    setDisconnecting(teamId);
    try {
      const token = await user.getIdToken();
      await fetch(`/api/slack/disconnect?teamId=${encodeURIComponent(teamId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      // Firestore subscription will update the UI automatically.
    } catch {
      // ignore — user can retry
    } finally {
      setDisconnecting(null);
    }
  };

  // Trigger message history backfill for a workspace.
  const handleBackfill = async (teamId: string) => {
    if (!user || backfilling) return;
    setBackfilling(teamId);
    try {
      const token = await user.getIdToken();
      await fetch("/api/slack/backfill", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
    } catch {
      // ignore — non-critical
    } finally {
      setBackfilling(null);
    }
  };

  const hasWorkspaces = slackWorkspaces.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border/60 px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Integrations</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Connect Slack to receive alerts and sync message history</p>
          </div>
          {hasWorkspaces && (
            <Button size="sm" onClick={handleConnect} disabled={connecting} className="shrink-0">
              {connecting
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <Plus className="mr-1.5 h-3.5 w-3.5" />
              }
              {connecting ? "Redirecting…" : "Add Workspace"}
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StatPill
            value={slackWorkspaces.length}
            label="Connected"
            dot="emerald"
          />
          <StatPill
            value={slackWorkspaces.reduce((acc, w) => acc + (w.selectedChannels?.length ?? 0), 0)}
            label="Channels"
            dot="muted"
          />
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-10">

          {/* Empty state */}
          {!hasWorkspaces && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10 mb-5">
                <MessageSquare className="h-8 w-8 text-purple-400" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Connect your Slack workspace</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
                Bring Slack signals into Speckula. Automatically surface pain points, alerts, and digests from your team channels.
              </p>
              {connectError && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {connectError}
                </div>
              )}
              <Button className="mt-6" onClick={handleConnect} disabled={connecting}>
                {connecting
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <MessageSquare className="mr-2 h-4 w-4" />
                }
                {connecting ? "Redirecting to Slack…" : "Connect Slack"}
              </Button>
            </div>
          )}

          {/* Connected workspaces */}
          {hasWorkspaces && (
            <section>
              <SectionHeader
                title="Connected"
                count={slackWorkspaces.length}
                description="Slack workspaces syncing to SPECKULA"
              />
              {connectError && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {connectError}
                </div>
              )}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {slackWorkspaces.map((workspace) => (
                  <WorkspaceCard
                    key={workspace.teamId}
                    workspace={workspace}
                    onDisconnect={handleDisconnect}
                    onBackfill={handleBackfill}
                    disconnecting={disconnecting}
                    backfilling={backfilling}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Data flow */}
          {hasWorkspaces && (
            <section>
              <SectionHeader title="Data Flow" description="SPECKULA receives live intelligence from your connected tools" />
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-card/50 px-5 py-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" /><span>SPECKULA</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                {slackWorkspaces.map((ws, idx) => (
                  <React.Fragment key={ws.teamId}>
                    <div className="flex items-center gap-2 rounded-lg border bg-purple-500/10 text-purple-400 border-purple-500/20 px-3 py-1.5">
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-xs font-medium">{ws.teamName}</span>
                    </div>
                    {idx < slackWorkspaces.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30" />}
                  </React.Fragment>
                ))}
              </div>
            </section>
          )}

          {/* Activity log */}
          <section>
            <SectionHeader
              title="Recent Activity"
              description="Latest events from connected integrations"
            />
            <div className="mt-4 overflow-hidden rounded-xl border border-border/60 bg-card">
              {activityLoading && (
                <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Loading activity…</span>
                </div>
              )}
              {!activityLoading && activityLog.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Activity className="mb-2 h-6 w-6 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">
                    {workspaceId ? "No recent activity." : "Connect a workspace to see activity."}
                  </p>
                </div>
              )}
              {!activityLoading && activityLog.length > 0 && (
                <ul className="divide-y divide-border/40">
                  {activityLog.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-start gap-4 border-l-2 border-l-purple-400 px-5 py-3.5 transition-colors hover:bg-muted/30"
                    >
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        {entry.integration === "Slack"
                          ? <MessageSquare className="h-3.5 w-3.5" />
                          : <Activity className="h-3.5 w-3.5" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                            {entry.integration}
                          </span>
                          <span className="text-xs font-medium text-foreground">{entry.action}</span>
                        </div>
                        {entry.detail && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.detail}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground/70">{entry.time}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

interface StatPillProps {
  label: string;
  value: number | string;
  dot: "emerald" | "red" | "muted";
}

function StatPill({ label, value, dot }: StatPillProps) {
  const dotColors = {
    emerald: "bg-emerald-400",
    red: "bg-red-400",
    muted: "bg-muted-foreground/40",
  };
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card px-3 py-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${dotColors[dot]}`} />
      <span className="text-xs font-semibold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  count?: number;
  description?: string;
}

function SectionHeader({ title, count, description }: SectionHeaderProps) {
  return (
    <div className="flex items-baseline gap-2.5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {count !== undefined && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{count}</span>
      )}
      {description && (
        <span className="hidden text-xs text-muted-foreground sm:block">— {description}</span>
      )}
    </div>
  );
}
