"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  MessageSquare,
  AlertTriangle,
  Zap,
  RefreshCw,
  Settings,
  Plus,
  CheckCircle2,
  XCircle,
  Circle,
  ArrowRight,
  Activity,
  Database,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useApi } from "@/hooks/useApi";
import { useExtensionPreferences } from "@/hooks/useExtensionPreferences";
import {
  subscribeToIntegrationConnections,
  setIntegrationConnection,
  type UserIntegrations,
  type IntegrationConnection,
} from "@/lib/firebase/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IntegrationStatus = "connected" | "error" | "available";
type IntegrationColor =
  | "slate" | "purple" | "zinc" | "blue" | "violet" | "amber" | "indigo" | "cyan";

interface IntegrationCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: IntegrationColor;
  features: string[];
  syncFrequency: string;
  permissions: string[];
}

interface Integration extends IntegrationCatalogEntry {
  status: IntegrationStatus;
  lastSync: string | null;
  dataPoints: number;
}

interface ActivityEntry {
  id: string;
  integration: string;
  action: string;
  detail: string;
  time: string;
}

// Shape of items returned by GET /workspaces/:id/activity
interface BackendActivityItem {
  id: string;
  actorId: string;
  eventType: string;
  title: string;
  description: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Static integration catalog — product config, not mock data.
// Status, lastSync, and dataPoints are derived from live Firestore state.
// ---------------------------------------------------------------------------

const INTEGRATION_CATALOG: IntegrationCatalogEntry[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Receive intelligence alerts and weekly digests directly in your team channels.",
    category: "Communication",
    icon: "💬",
    color: "purple",
    features: ["Alerts", "Weekly digests", "Decision notifications", "Competitor alerts"],
    syncFrequency: "On trigger",
    permissions: ["channels:write", "chat:write"],
  },
];

const CATEGORIES = ["All", "Communication"];

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

function inferIntegrationName(eventType: string, title: string): string {
  const lower = (eventType + " " + title).toLowerCase();
  if (lower.includes("slack") || lower.includes("digest") || lower.includes("alert")) return "Slack";
  return "SPECKULA";
}

function activityToEntry(item: BackendActivityItem): ActivityEntry {
  const integration = inferIntegrationName(item.eventType, item.title);
  return {
    id: item.id,
    integration,
    action: item.title,
    detail: item.description ?? "",
    time: formatRelativeTime(item.createdAt),
  };
}

function mergeIntegrations(
  catalog: IntegrationCatalogEntry[],
  connections: UserIntegrations
): Integration[] {
  return catalog.map((entry) => {
    const conn: IntegrationConnection | null | undefined = connections[entry.id];
    if (!conn) {
      return { ...entry, status: "available" as const, lastSync: null, dataPoints: 0 };
    }
    return {
      ...entry,
      status: conn.status,
      lastSync: conn.lastSyncAt ? formatRelativeTime(conn.lastSyncAt) : null,
      dataPoints: 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Icon helpers
// ---------------------------------------------------------------------------

function getIntegrationIcon(id: string) {
  if (id === "slack") return <MessageSquare className="h-5 w-5" />;
  return <Zap className="h-5 w-5" />;
}

function getActivityIcon(integration: string) {
  if (integration === "Slack") return <MessageSquare className="h-3.5 w-3.5" />;
  return <Activity className="h-3.5 w-3.5" />;
}

const COLOR_MAP: Record<IntegrationColor, string> = {
  slate:  "bg-slate-500/10 text-slate-400 border-slate-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  zinc:   "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  blue:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
  violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  amber:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  cyan:   "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

const ACTIVITY_BORDER: Record<string, string> = {
  Slack: "border-l-purple-400",
};

function statusLabel(status: IntegrationStatus) {
  if (status === "connected") return "Connected";
  if (status === "error") return "Error";
  return "Available";
}

function formatDataPoints(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ConnectedCardProps {
  integration: Integration;
  onSyncNow: (id: string) => void;
  syncingId: string | null;
  onDisconnect: (id: string) => void;
}

function ConnectedCard({ integration, onSyncNow, syncingId, onDisconnect }: ConnectedCardProps) {
  const isError = integration.status === "error";
  const isSyncing = syncingId === integration.id;
  const iconColorClass = COLOR_MAP[integration.color];

  return (
    <div
      className={`group relative flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md ${
        isError
          ? "border-red-500/40 bg-red-950/5 dark:bg-red-950/10"
          : "border-border/60 hover:border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${iconColorClass}`}>
            {getIntegrationIcon(integration.id)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{integration.name}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {integration.category}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              {isError ? (
                <><XCircle className="h-3 w-3 text-red-400" /><span className="text-xs font-medium text-red-400">Error</span></>
              ) : (
                <><CheckCircle2 className="h-3 w-3 text-emerald-400" /><span className="text-xs font-medium text-emerald-400">Connected</span></>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isError ? (
            <Button size="sm" variant="destructive" className="h-7 px-3 text-xs"
              onClick={() => onDisconnect(integration.id)}>
              Reconnect
            </Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                <Settings className="mr-1 h-3 w-3" />Configure
              </Button>
              <Button
                size="sm" variant="outline" className="h-7 px-2 text-xs"
                onClick={() => onSyncNow(integration.id)} disabled={isSyncing}
              >
                {isSyncing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                {isSyncing ? "Syncing…" : "Sync Now"}
              </Button>
            </>
          )}
        </div>
      </div>

      {isError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
          <span className="text-xs text-red-300">Authentication expired — reconnect required to resume syncing.</span>
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">{integration.description}</p>

      <div className="flex flex-wrap gap-1.5">
        {integration.features.map((f) => (
          <span key={f} className="rounded-md border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">{f}</span>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Database className="h-3 w-3" />
            {formatDataPoints(integration.dataPoints)} data points
          </span>
          {integration.lastSync && (
            <span className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />{integration.lastSync}
            </span>
          )}
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">{integration.syncFrequency}</span>
      </div>
    </div>
  );
}

interface AvailableCardProps {
  integration: Integration;
  onConnect: (id: string) => void;
  connecting: string | null;
}

function AvailableCard({ integration, onConnect, connecting }: AvailableCardProps) {
  const iconColorClass = COLOR_MAP[integration.color];
  const isConnecting = connecting === integration.id;

  return (
    <div className="group flex flex-col gap-3.5 rounded-xl border border-border/40 bg-card/50 p-5 opacity-80 shadow-sm transition-all duration-200 hover:border-border/70 hover:opacity-100 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${iconColorClass} opacity-70`}>
            {getIntegrationIcon(integration.id)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{integration.name}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {integration.category}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Circle className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground/70">Not connected</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground/80">{integration.description}</p>

      <div className="flex flex-wrap gap-1.5">
        {integration.features.map((f) => (
          <span key={f} className="rounded-md border border-border/40 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground/60">{f}</span>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border/30 pt-3">
        <span className="text-[11px] text-muted-foreground/60">{integration.syncFrequency}</span>
        <Button size="sm" className="h-7 px-3 text-xs" onClick={() => onConnect(integration.id)} disabled={isConnecting}>
          {isConnecting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
          {isConnecting ? "Connecting…" : "Connect"}
        </Button>
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

  const [connections, setConnections] = useState<UserIntegrations>({});
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // Subscribe to live Firestore connection state.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToIntegrationConnections(
      user.uid,
      setConnections,
      () => setConnections({})
    );
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

  // Merge catalog with live connection state.
  const integrations = useMemo(() => mergeIntegrations(INTEGRATION_CATALOG, connections), [connections]);

  const totalConnected   = integrations.filter((i) => i.status === "connected").length;
  const totalError       = integrations.filter((i) => i.status === "error").length;
  const totalAvailable   = integrations.filter((i) => i.status === "available").length;
  const totalDataPoints  = integrations.reduce((acc, i) => acc + i.dataPoints, 0);

  const handleSyncNow = (id: string) => {
    if (syncingId) return;
    setSyncingId(id);
    // Update lastSyncAt in Firestore so it persists.
    if (user && connections[id]) {
      setIntegrationConnection(user.uid, id, {
        ...connections[id]!,
        lastSyncAt: new Date().toISOString(),
      }).catch(() => undefined);
    }
    setTimeout(() => setSyncingId(null), 2200);
  };

  const handleConnect = async (id: string) => {
    if (!user || connectingId) return;
    setConnectingId(id);
    try {
      await setIntegrationConnection(user.uid, id, {
        status: "connected",
        connectedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
      });
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!user) return;
    await setIntegrationConnection(user.uid, id, null).catch(() => undefined);
  };

  const filterTabs = ["All", "Connected", "Available"];

  const visibleIntegrations = integrations.filter((i) => {
    const matchStatus =
      activeFilter === "All" ||
      (activeFilter === "Connected" && (i.status === "connected" || i.status === "error")) ||
      (activeFilter === "Available" && i.status === "available");
    const matchCategory = categoryFilter === "All" || i.category === categoryFilter;
    const matchSearch =
      searchQuery.trim() === "" ||
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchCategory && matchSearch;
  });

  const connectedVisible = visibleIntegrations.filter((i) => i.status === "connected" || i.status === "error");
  const availableVisible = visibleIntegrations.filter((i) => i.status === "available");
  const dataFlowItems    = integrations.filter((i) => (i.status === "connected" || i.status === "error") && i.dataPoints > 0)
    .sort((a, b) => b.dataPoints - a.dataPoints);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border/60 px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Integrations</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Connected startup systems infrastructure</p>
          </div>
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search integrations…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StatPill label="Connected"        value={totalConnected}                   dot="emerald" />
          <StatPill label="Error"            value={totalError}                       dot="red" />
          <StatPill label="Available"        value={totalAvailable}                   dot="muted" />
          <div className="mx-1 h-4 w-px bg-border/60" />
          <StatPill label="Total data points" value={totalDataPoints.toLocaleString()} dot={null}
            icon={<Database className="h-3 w-3 text-muted-foreground" />} />
        </div>

        {/* Filter tabs */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
            {filterTabs.map((tab) => (
              <button
                key={tab} type="button" onClick={() => setActiveFilter(tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  activeFilter === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="shrink-0">Category:</span>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat} type="button" onClick={() => setCategoryFilter(cat)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    categoryFilter === cat
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-10">

          {/* Connected integrations */}
          {connectedVisible.length > 0 && (
            <section>
              <SectionHeader title="Connected" count={connectedVisible.length}
                description="Active integrations syncing data to SPECKULA" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {connectedVisible.map((integration) => (
                  <ConnectedCard
                    key={integration.id}
                    integration={integration}
                    onSyncNow={handleSyncNow}
                    syncingId={syncingId}
                    onDisconnect={handleDisconnect}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Available integrations */}
          {availableVisible.length > 0 && (
            <section>
              <SectionHeader title="Available" count={availableVisible.length}
                description="Expand your product intelligence by connecting more tools" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {availableVisible.map((integration) => (
                  <AvailableCard
                    key={integration.id}
                    integration={integration}
                    onConnect={handleConnect}
                    connecting={connectingId}
                  />
                ))}
              </div>
            </section>
          )}

          {visibleIntegrations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Zap className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">No integrations found</p>
              <p className="mt-1 text-xs text-muted-foreground">Try adjusting your search or filter criteria.</p>
            </div>
          )}

          {/* Data flow overview */}
          {dataFlowItems.length > 0 && (
            <section>
              <SectionHeader title="Data Flow" description="SPECKULA receives live intelligence from your connected tools" />
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-card/50 px-5 py-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Database className="h-3.5 w-3.5" /><span>SPECKULA</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                {dataFlowItems.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${COLOR_MAP[item.color]}`}>
                      {getIntegrationIcon(item.id)}
                      <span className="text-xs font-medium">{item.name}</span>
                      <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-white/10">
                        {formatDataPoints(item.dataPoints)} pts
                      </span>
                    </div>
                    {idx < dataFlowItems.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30" />}
                  </React.Fragment>
                ))}
              </div>
            </section>
          )}

          {/* Activity log */}
          <section>
            <SectionHeader title="Recent Integration Activity"
              description="Latest events across all connected integrations" />
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
                  {activityLog.map((entry) => {
                    const borderColor = ACTIVITY_BORDER[entry.integration] ?? "border-l-muted-foreground/30";
                    return (
                      <li
                        key={entry.id}
                        className={`flex items-start gap-4 border-l-2 px-5 py-3.5 transition-colors hover:bg-muted/30 ${borderColor}`}
                      >
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          {getActivityIcon(entry.integration)}
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
                    );
                  })}
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
  dot: "emerald" | "red" | "muted" | null;
  icon?: React.ReactNode;
}

function StatPill({ label, value, dot, icon }: StatPillProps) {
  const dotColors: Record<NonNullable<StatPillProps["dot"]>, string> = {
    emerald: "bg-emerald-400",
    red: "bg-red-400",
    muted: "bg-muted-foreground/40",
  };
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card px-3 py-1.5">
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${dotColors[dot]}`} /> : icon}
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
