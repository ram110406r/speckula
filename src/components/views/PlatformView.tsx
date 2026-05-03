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
      // profile data loaded for future use
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
        <div className="max-w-md rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm">
          <Users className="mx-auto h-10 w-10 text-primary/50" />
          <h1 className="mt-4 text-lg font-semibold">Platform mode needs a signed-in user.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to manage your public profile and team workspaces.</p>
        </div>
      </div>
    );
  }

  // profile save handled elsewhere; omitted in timeline UI

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

  // UI helpers
  const docs = useAppStore.getState().documents;

  const activeDoc = docs.find((d) => d.id === currentDocId) ?? null;

  const latestDecision = decisions[0] ?? null;

  const computeScore = () => {
    if (!latestDecision) return null;
    return latestDecision.score ?? Math.round((latestDecision.impact || 0) * (latestDecision.confidence || 0));
  };

  const score = computeScore();

  const healthColor = (s: number | null) => {
    if (s === null) return "text-muted-foreground";
    if (s >= 80) return "text-emerald-500";
    if (s >= 50) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border/60 bg-card/60 px-4 md:px-8 h-14 shrink-0">
        <div className="flex items-center gap-3">
          <Network className="h-4 w-4 text-primary" />
          <span className="label-system text-[12px]">Platform Mode</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-8 label-system text-[12px]"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(publicProfileLink);
              } catch (error) {
                console.error("Failed to copy profile link:", error);
                alert("Could not copy the profile link.");
              }
            }}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Profile Link
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border/40 bg-card/20 px-4 md:px-8 py-3 shrink-0 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 label-system text-[12px] transition-all ${
                active ? "border-primary bg-primary text-white" : "border-border/60 bg-card hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto p-6 custom-scrollbar">
        {isLoading ? (
          <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-border/40 bg-card">
            <p className="label-system text-[12px] text-muted-foreground">Loading platform</p>
          </div>
        ) : activeTab === "portfolio" ? (
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-[320px_1fr]">
            {/* Left panel: Case selector */}
            <aside className="h-full">
              <div className="sticky top-6 space-y-4">
                <div className="rounded-2xl border border-border/60 bg-card p-4">
                  <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Cases</p>
                  <div className="mt-3 space-y-2">
                    {docs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No cases yet — create a document to get started.</p>
                    ) : (
                      docs.map((doc) => {
                        const docDecisions = decisionsAll.filter((d) => d.sourceDocId === doc.id);
                        const badge = docDecisions.length > 0 ? Math.round((docDecisions.reduce((s, d) => s + (d.score ?? 0), 0) / docDecisions.length) || 0) : null;
                        const active = doc.id === currentDocId;
                        return (
                          <button
                            key={doc.id}
                            onClick={() => useAppStore.getState().setCurrentDocId(doc.id)}
                            className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-colors ${active ? "bg-accent text-primary font-semibold" : "hover:bg-muted"}`}
                          >
                            <div>
                              <div className="text-sm truncate">{doc.title}</div>
                              <div className="text-xs text-muted-foreground">{millisFromTimestamp(doc.updatedAt) ? new Date(millisFromTimestamp(doc.updatedAt) as number).toLocaleString() : "-"}</div>
                            </div>
                            {badge !== null && (
                              <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge >= 80 ? "bg-emerald-50 text-emerald-600" : badge >=50 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}`}>{badge}</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </aside>

            {/* Main panel */}
            <main className="space-y-6">
              <section className="rounded-2xl border border-border/60 bg-card p-6">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-semibold">{activeDoc?.title ?? "Untitled Case"}</h1>
                    <p className="text-sm text-muted-foreground mt-1">{activeDoc ? "A living record of this case's evolution" : "Open a case to view its decision timeline"}</p>
                      <div className="mt-3 text-[12px] text-muted-foreground flex items-center gap-4">
                      <span><Clock className="mr-1 inline h-3 w-3" /> {millisFromTimestamp(activeDoc?.updatedAt) ? new Date(millisFromTimestamp(activeDoc?.updatedAt) as number).toLocaleString() : "-"}</span>
                      <span>{decisions.length} decisions</span>
                      <span className="px-2 py-0.5 rounded-full bg-muted/10 text-[11px]">{decisions.length > 0 ? "Active" : "Draft"}</span>
                    </div>
                  </div>
                  <div className="w-full sm:w-auto sm:min-w-[220px]">
                    <div className="sticky top-6 rounded-xl border border-border bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Score</p>
                          <div className="text-3xl font-mono mt-1">{score ?? "—"}</div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${healthColor(score ?? null)}`}>{score !== null ? (score >= 80 ? "Healthy" : score >=50 ? "Watch" : "Risk") : "Unknown"}</p>
                          <p className="text-xs text-muted-foreground mt-1">Confidence: {latestDecision?.confidence ?? "—"}</p>
                        </div>
                      </div>
                      <div className="mt-3 text-[13px] text-muted-foreground">{latestDecision?.keyInsight ?? "No AI insights yet — run signal extraction."}</div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Timeline */}
              <section className="space-y-4">
                <div className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Decision Timeline</div>
                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-px bg-border/40" />
                  <div className="space-y-6 pl-12">
                    <TimelineStep
                      title="Problem Defined"
                      status={"complete"}
                      timestamp={millisFromTimestamp(activeDoc?.updatedAt)}
                    >
                      <div className="text-sm">
                        <p className="font-medium">Who: {user.displayName}</p>
                        <p className="mt-1 text-muted-foreground">Behavior: Describe the user behavior your product addresses.</p>
                        <p className="mt-1 text-muted-foreground">Metric: (add a measurable metric)</p>
                      </div>
                    </TimelineStep>

                    <TimelineStep title="Signals Detected" status={insights.length > 0 ? "active" : "pending"} timestamp={millisFromTimestamp(insights[0]?.createdAt)}>
                      {insights.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No signals detected — run insights extraction.</p>
                      ) : (
                        <ul className="list-disc pl-5 text-sm">
                          {insights.map((s) => (
                            <li key={s.id} className="text-sm">{s.title} <div className="text-xs text-muted-foreground">{s.category}</div></li>
                          ))}
                        </ul>
                      )}
                    </TimelineStep>

                    <TimelineStep title="Arguments Built" status={decisions.length > 0 ? "active" : "pending"} timestamp={millisFromTimestamp(decisions[0]?.createdAt)}>
                      <div className="text-sm">
                        {decisions.length === 0 ? (
                          <p className="text-muted-foreground">No arguments recorded yet.</p>
                        ) : (
                          decisions.map((d) => (
                            <div key={d.id} className="rounded-xl border border-border p-3 mb-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium text-sm">{d.title}</p>
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
                              <p className="text-xs text-muted-foreground mt-1">Pros/Cons summarized</p>
                            </div>
                          ))
                        )}
                      </div>
                    </TimelineStep>

                    <TimelineStep title="Decision Made" status={decisions.length > 0 ? "complete" : "pending"} timestamp={millisFromTimestamp(decisions[0]?.createdAt)}>
                      {decisions.length === 0 ? (
                        <p className="text-muted-foreground">No decision yet — open Decisions view to add one.</p>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm">{decisions[0].title}</p>
                            {decisions[0].published && (
                              <button
                                className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700"
                                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/case/${decisions[0].id}`).catch(() => {})}
                                title="Copy public link"
                              >
                                <Globe className="h-3 w-3" />Copy link
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Score: {decisions[0].score ?? "—"} · Confidence: {decisions[0].confidence ?? "—"}</p>
                          <p className="mt-2 text-sm">{decisions[0].justification}</p>
                        </div>
                      )}
                    </TimelineStep>

                    <TimelineStep title="Outcome" status={decisions.length > 0 ? "pending" : "pending"} timestamp={millisFromTimestamp(decisions[0]?.updatedAt)}>
                      <div>
                        <p className="text-sm text-muted-foreground">Outcomes and metrics will appear here once recorded.</p>
                      </div>
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

function TimelineStep({ title, status, timestamp, children }: { title: string; status: "pending" | "active" | "complete"; timestamp?: number; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <div className="absolute left-0 top-1.5">
        <div className={`h-3 w-3 rounded-full ${status === "complete" ? "bg-emerald-500" : status === "active" ? "bg-amber-500" : "bg-muted-foreground/30"}`} />
      </div>
      <div className={`rounded-xl bg-white border p-4 border-[#E6EAF0] shadow-sm transition-transform hover:-translate-y-0.5`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">{title}</h4>
              <span className="text-xs text-muted-foreground">{timestamp ? new Date(timestamp).toLocaleString() : ""}</span>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{/* short preview */}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen((s) => !s)} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{open ? "Collapse" : "Expand"}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
        {open && <div className="mt-3">{children}</div>}
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
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm space-y-4">
        <div>
          <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Workspace Dashboard</p>
          <h3 className="mt-2 text-base font-semibold">Create a team workspace</h3>
        </div>
        <Input value={workspaceName} onChange={(event) => onWorkspaceNameChange(event.target.value)} placeholder="Workspace name" />
        <Button onClick={onCreateWorkspace} className="w-full">Create Workspace</Button>
        <p className="text-xs text-muted-foreground">Owners manage membership; viewers can inspect shared work.</p>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Shared Workspaces</p>
            <h3 className="mt-2 text-base font-semibold">Collaboration hubs</h3>
          </div>
          <span className="label-system text-[12px] text-muted-foreground">{workspaces.length}</span>
        </div>

        {workspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workspaces yet. Create one to start collaborating.</p>
        ) : (
          <div className="space-y-3">
            {workspaces.map((workspace) => (
              <div key={workspace.id} className="rounded-xl border border-border/60 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{workspace.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{(workspace.members || []).length} members</p>
                  </div>
                  <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{(workspace.members || []).find((member) => member.userId === userId)?.role ?? "viewer"}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Input value={inviteTarget} onChange={(event) => onInviteTargetChange(event.target.value)} placeholder="Invite by userId" />
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
