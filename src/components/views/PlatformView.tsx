"use client";

import React from "react";
import { Copy, Globe, Link2, Network, Sparkles, Users, ChevronDown, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import {
  getDecisions,
  getInsights,
  getPublicProfile,
  getWorkspacesForUser,
  inviteWorkspaceMember,
  saveWorkspace,
  type DecisionRecord,
  type Insight,
  type TeamWorkspace,
} from "@/lib/firebase/db";

type PlatformTab = "portfolio" | "workspaces";

const tabs: Array<{ id: PlatformTab; label: string; icon: React.ElementType }> = [
  { id: "portfolio", label: "Portfolio", icon: Sparkles },
  { id: "workspaces", label: "Workspaces", icon: Users },
];

function profileUrl(userId: string) {
  return `/u/${userId}`;
}

function getOriginPath(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function PlatformView() {
  const { user } = useAuth();
  const { currentDocId } = useAppStore();
  const [activeTab, setActiveTab] = React.useState<PlatformTab>("portfolio");
  const [workspaces, setWorkspaces] = React.useState<(TeamWorkspace & { id: string })[]>([]);
  const [decisionsAll, setDecisionsAll] = React.useState<DecisionRecord[]>([]);
  const [decisions, setDecisions] = React.useState<DecisionRecord[]>([]);
  const [insights, setInsights] = React.useState<Insight[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [inviteTarget, setInviteTarget] = React.useState("");

  const loadPlatformData = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [, workspaceData, decisionData, insightData] = await Promise.all([
        getPublicProfile(user.uid),
        getWorkspacesForUser(user.uid),
        getDecisions(user.uid),
        getInsights(user.uid),
      ]);
      const scopedDecisions = currentDocId
        ? decisionData.filter((decision) => decision.sourceDocId === currentDocId)
        : [];

      setWorkspaces(workspaceData);
      setDecisionsAll(decisionData);
      setDecisions(scopedDecisions);
      setInsights((insightData as Insight[]) || []);
    } catch (error) {
      console.error("Failed to load platform data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, currentDocId]);

  React.useEffect(() => {
    loadPlatformData();
  }, [loadPlatformData]);

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <Users className="mx-auto h-10 w-10 text-primary/50" />
          <h1 className="mt-4 text-lg font-semibold">Platform mode needs a signed-in user.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to manage your public profile and team workspaces.</p>
        </div>
      </div>
    );
  }

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) return;
    try {
      await saveWorkspace(user.uid, workspaceName.trim());
      setWorkspaceName("");
      await loadPlatformData();
    } catch (error) {
      console.error("Failed to create workspace:", error);
      alert("Failed to create workspace.");
    }
  };

  const handleInviteMember = async (workspaceId: string) => {
    if (!inviteTarget.trim()) return;
    try {
      await inviteWorkspaceMember(workspaceId, { userId: inviteTarget.trim(), role: "viewer" });
      setInviteTarget("");
      await loadPlatformData();
    } catch (error) {
      console.error("Failed to invite workspace member:", error);
      alert("Failed to invite member.");
    }
  };

  const publicProfileLink = getOriginPath(profileUrl(user.uid));

  function millisFromTimestamp(ts: unknown): number | undefined {
    if (!ts) return undefined;
    if (typeof ts === "number") return ts;
    if (typeof ts === "string") {
      const n = Date.parse(ts);
      return Number.isNaN(n) ? undefined : n;
    }
    if (typeof ts === "object") {
      const t = ts as { seconds?: number; toDate?: () => Date };
      if (typeof t.seconds === "number") return t.seconds * 1000;
      if (typeof t.toDate === "function") return t.toDate().getTime();
    }
    return undefined;
  }

  const docs = useAppStore.getState().documents;
  const activeDoc = docs.find((d) => d.id === currentDocId) ?? null;
  const latestDecision = decisions[0] ?? null;

  const computeScore = () => {
    if (!latestDecision) return null;
    return latestDecision.score ?? Math.round((latestDecision.impact || 0) * (latestDecision.confidence || 0));
  };

  const score = computeScore();

  const healthLabel = (s: number | null) => {
    if (s === null) return { text: "Unknown", cls: "text-muted-foreground" };
    if (s >= 80) return { text: "Healthy", cls: "text-emerald-600 dark:text-emerald-400" };
    if (s >= 50) return { text: "Watch", cls: "text-amber-600 dark:text-amber-400" };
    return { text: "Risk", cls: "text-red-600 dark:text-red-400" };
  };

  const health = healthLabel(score ?? null);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 md:px-8 h-14 shrink-0">
        <div className="flex items-center gap-2.5">
          <Network className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Platform Mode</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(publicProfileLink);
            } catch (error) {
              console.error("Failed to copy profile link:", error);
              alert("Could not copy the profile link.");
            }
          }}
        >
          <Copy className="h-3.5 w-3.5" /> Copy Profile Link
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-2 border-b border-border bg-background px-4 md:px-8 py-2.5 shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded px-3.5 py-1.5 text-[12px] font-medium transition-all ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-[12px] text-muted-foreground">Loading…</p>
          </div>
        ) : activeTab === "portfolio" ? (
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-[300px_1fr]">
            {/* Case selector */}
            <aside>
              <div className="lg:sticky lg:top-0">
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">Cases</p>
                  <div className="space-y-1">
                    {docs.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No cases yet — create a document to get started.</p>
                    ) : (
                      docs.map((doc) => {
                        const docDecisions = decisionsAll.filter((d) => d.sourceDocId === doc.id);
                        const badge = docDecisions.length > 0
                          ? Math.round((docDecisions.reduce((s, d) => s + (d.score ?? 0), 0) / docDecisions.length) || 0)
                          : null;
                        const active = doc.id === currentDocId;
                        return (
                          <button
                            key={doc.id}
                            onClick={() => useAppStore.getState().setCurrentDocId(doc.id)}
                            className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg transition-colors ${
                              active
                                ? "bg-primary/10 border border-primary/20 text-primary"
                                : "hover:bg-muted text-foreground border border-transparent"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className={`text-sm font-medium truncate ${active ? "text-primary" : ""}`}>{doc.title}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {millisFromTimestamp(doc.updatedAt)
                                  ? new Date(millisFromTimestamp(doc.updatedAt) as number).toLocaleString()
                                  : "—"}
                              </div>
                            </div>
                            {badge !== null && (
                              <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                                badge >= 80
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : badge >= 50
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              }`}>
                                {badge}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </aside>

            {/* Main content */}
            <main className="space-y-5 min-w-0">
              {/* Case header card */}
              <section className="rounded-xl border border-border bg-card p-5">
                {/* Title row */}
                <div className="mb-4">
                  <h1 className="text-xl font-semibold leading-tight truncate">
                    {activeDoc?.title ?? "Untitled Case"}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeDoc ? "A living record of this case's evolution" : "Open a case to view its decision timeline"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {millisFromTimestamp(activeDoc?.updatedAt)
                        ? new Date(millisFromTimestamp(activeDoc?.updatedAt) as number).toLocaleString()
                        : "—"}
                    </span>
                    <span>{decisions.length} decisions</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      decisions.length > 0
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {decisions.length > 0 ? "Active" : "Draft"}
                    </span>
                  </div>
                </div>

                {/* Score row */}
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Decision Score</p>
                      <p className="text-3xl font-mono font-semibold mt-1 tabular-nums">
                        {score !== null ? score : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${health.cls}`}>{health.text}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Confidence: {latestDecision?.confidence ?? "—"}
                      </p>
                    </div>
                  </div>
                  {latestDecision?.keyInsight && (
                    <p className="mt-3 text-[13px] text-muted-foreground border-t border-border pt-3">
                      {latestDecision.keyInsight}
                    </p>
                  )}
                  {!latestDecision?.keyInsight && (
                    <p className="mt-3 text-[13px] text-muted-foreground/60 border-t border-border pt-3">
                      No AI insights yet — run signal extraction.
                    </p>
                  )}
                </div>
              </section>

              {/* Decision Timeline */}
              <section className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground px-1">
                  Decision Timeline
                </p>
                <div className="relative">
                  <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border" />
                  <div className="space-y-3 pl-10">
                    <TimelineStep
                      title="Problem Defined"
                      status="complete"
                      timestamp={millisFromTimestamp(activeDoc?.updatedAt)}
                    >
                      <div className="text-sm space-y-1">
                        <p className="font-medium">Who: {user.displayName}</p>
                        <p className="text-muted-foreground">Behavior: Describe the user behavior your product addresses.</p>
                        <p className="text-muted-foreground">Metric: (add a measurable metric)</p>
                      </div>
                    </TimelineStep>

                    <TimelineStep
                      title="Signals Detected"
                      status={insights.length > 0 ? "active" : "pending"}
                      timestamp={millisFromTimestamp(insights[0]?.createdAt)}
                    >
                      {insights.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No signals detected — run insights extraction.</p>
                      ) : (
                        <ul className="space-y-1">
                          {insights.map((s) => (
                            <li key={s.id} className="text-sm">
                              {s.title}
                              <span className="ml-2 text-[11px] text-muted-foreground">{s.category}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TimelineStep>

                    <TimelineStep
                      title="Arguments Built"
                      status={decisions.length > 0 ? "active" : "pending"}
                      timestamp={millisFromTimestamp(decisions[0]?.createdAt)}
                    >
                      {decisions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No arguments recorded yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {decisions.map((d) => (
                            <div key={d.id} className="rounded-lg border border-border bg-background p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium">{d.title}</p>
                                {d.published && (
                                  <button
                                    className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700"
                                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/case/${d.id}`).catch(() => {})}
                                    title="Copy public link"
                                  >
                                    <Globe className="h-3 w-3" />
                                    <Link2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              <p className="mt-1 text-[11px] text-muted-foreground">Pros/Cons summarized</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </TimelineStep>

                    <TimelineStep
                      title="Decision Made"
                      status={decisions.length > 0 ? "complete" : "pending"}
                      timestamp={millisFromTimestamp(decisions[0]?.createdAt)}
                    >
                      {decisions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No decision yet — open Decisions view to add one.</p>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{decisions[0].title}</p>
                            {decisions[0].published && (
                              <button
                                className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700"
                                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/case/${decisions[0].id}`).catch(() => {})}
                                title="Copy public link"
                              >
                                <Globe className="h-3 w-3" /> Copy link
                              </button>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Score: {decisions[0].score ?? "—"} · Confidence: {decisions[0].confidence ?? "—"}
                          </p>
                          <p className="mt-2 text-sm">{decisions[0].justification}</p>
                        </div>
                      )}
                    </TimelineStep>

                    <TimelineStep
                      title="Outcome"
                      status="pending"
                      timestamp={millisFromTimestamp(decisions[0]?.updatedAt)}
                    >
                      <p className="text-sm text-muted-foreground">Outcomes and metrics will appear here once recorded.</p>
                    </TimelineStep>
                  </div>
                </div>
              </section>
            </main>
          </div>
        ) : (
          <WorkspaceSection
            userId={user.uid}
            workspaces={workspaces}
            workspaceName={workspaceName}
            inviteTarget={inviteTarget}
            onWorkspaceNameChange={setWorkspaceName}
            onInviteTargetChange={setInviteTarget}
            onCreateWorkspace={handleCreateWorkspace}
            onInviteMember={handleInviteMember}
          />
        )}
      </div>
    </div>
  );
}

function TimelineStep({
  title,
  status,
  timestamp,
  children,
}: {
  title: string;
  status: "pending" | "active" | "complete";
  timestamp?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  const dotCls =
    status === "complete"
      ? "bg-emerald-500"
      : status === "active"
      ? "bg-amber-500"
      : "bg-muted-foreground/25 border border-border";

  return (
    <div className="relative">
      {/* Timeline dot */}
      <div className={`absolute -left-[29px] top-3.5 h-3 w-3 rounded-full ${dotCls}`} />
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <h4 className="text-sm font-medium">{title}</h4>
            {timestamp && (
              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                {new Date(timestamp).toLocaleString()}
              </span>
            )}
          </div>
          <button
            onClick={() => setOpen((s) => !s)}
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {open ? "Collapse" : "Expand"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
        {open && (
          <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkspaceSection({
  userId,
  workspaces,
  workspaceName,
  inviteTarget,
  onWorkspaceNameChange,
  onInviteTargetChange,
  onCreateWorkspace,
  onInviteMember,
}: {
  userId: string;
  workspaces: (TeamWorkspace & { id: string })[];
  workspaceName: string;
  inviteTarget: string;
  onWorkspaceNameChange: (value: string) => void;
  onInviteTargetChange: (value: string) => void;
  onCreateWorkspace: () => void;
  onInviteMember: (workspaceId: string) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Workspace Dashboard</p>
          <h3 className="mt-2 text-base font-semibold">Create a team workspace</h3>
        </div>
        <Input value={workspaceName} onChange={(e) => onWorkspaceNameChange(e.target.value)} placeholder="Workspace name" />
        <Button onClick={onCreateWorkspace} className="w-full">Create Workspace</Button>
        <p className="text-xs text-muted-foreground">Owners manage membership; viewers can inspect shared work.</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Shared Workspaces</p>
            <h3 className="mt-2 text-base font-semibold">Collaboration hubs</h3>
          </div>
          <span className="text-[12px] text-muted-foreground tabular-nums">{workspaces.length}</span>
        </div>

        {workspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workspaces yet. Create one to start collaborating.</p>
        ) : (
          <div className="space-y-3">
            {workspaces.map((workspace) => (
              <div key={workspace.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{workspace.name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{(workspace.members || []).length} members</p>
                  </div>
                  <span className="rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] bg-muted text-muted-foreground">
                    {(workspace.members || []).find((m) => m.userId === userId)?.role ?? "viewer"}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Input value={inviteTarget} onChange={(e) => onInviteTargetChange(e.target.value)} placeholder="Invite by userId" />
                  <Button variant="outline" onClick={() => onInviteMember(workspace.id)}>Invite</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
