"use client";

import React from "react";
import {
  Copy, Globe, Link2, Network, Sparkles, Users, ChevronDown, Clock,
  CheckCircle2, Trash2, UserMinus, Pencil, X, Check, Plus, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToastStore";
import {
  getDecisions,
  getInsights,
  getWorkspacesForUser,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  saveWorkspace,
  updateWorkspace,
  deleteWorkspace,
  recordDecisionOutcome,
  type DecisionRecord,
  type Insight,
  type TeamWorkspace,
} from "@/lib/firebase/db";

type PlatformTab = "portfolio" | "workspaces";

const tabs: Array<{ id: PlatformTab; label: string; icon: React.ElementType }> = [
  { id: "portfolio", label: "Portfolio", icon: Sparkles },
  { id: "workspaces", label: "Workspaces", icon: Users },
];

function getOriginPath(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function millisFromTimestamp(ts: unknown): number | undefined {
  if (!ts) return undefined;
  if (typeof ts === "number") return ts;
  if (typeof ts === "string") { const n = Date.parse(ts); return Number.isNaN(n) ? undefined : n; }
  if (typeof ts === "object") {
    const t = ts as { seconds?: number; toDate?: () => Date };
    if (typeof t.seconds === "number") return t.seconds * 1000;
    if (typeof t.toDate === "function") return t.toDate().getTime();
  }
  return undefined;
}

export function PlatformView() {
  const { user } = useAuth();
  const { currentDocId, documents: docs } = useAppStore();
  const [activeTab, setActiveTab] = React.useState<PlatformTab>("portfolio");
  const [workspaces, setWorkspaces] = React.useState<(TeamWorkspace & { id: string })[]>([]);
  const [decisionsAll, setDecisionsAll] = React.useState<DecisionRecord[]>([]);
  const [decisions, setDecisions] = React.useState<DecisionRecord[]>([]);
  const [insights, setInsights] = React.useState<Insight[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Per-workspace form state — keyed by workspace.id so inputs don't bleed across cards
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [inviteInputs, setInviteInputs] = React.useState<Record<string, string>>({});
  const [roleInputs, setRoleInputs] = React.useState<Record<string, "editor" | "viewer">>({});
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");

  // Per-action loading flags — prevent double-fires without wiping the whole view
  const [isCreatingWorkspace, setIsCreatingWorkspace] = React.useState(false);
  const [invitingId, setInvitingId] = React.useState<string | null>(null);
  const [removingKey, setRemovingKey] = React.useState<string | null>(null); // `${wsId}:${memberId}`
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [isRenamingLoading, setIsRenamingLoading] = React.useState(false);

  // Outcome recording
  const [outcomeForm, setOutcomeForm] = React.useState<{
    decisionId: string;
    note: string;
    success: "yes" | "no" | "partial";
  } | null>(null);
  const [savingOutcome, setSavingOutcome] = React.useState(false);

  // Full load — used on mount and doc switch
  const loadPlatformData = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [workspaceData, decisionData, insightData] = await Promise.all([
        getWorkspacesForUser(user.uid),
        getDecisions(user.uid),
        getInsights(user.uid),
      ]);
      const scopedInsights = currentDocId
        ? (insightData as Insight[]).filter((i) => i.sourceDocId === currentDocId)
        : [];
      const scopedDecisions = currentDocId
        ? decisionData.filter((d) => d.sourceDocId === currentDocId)
        : [];
      setWorkspaces(workspaceData);
      setDecisionsAll(decisionData);
      setDecisions(scopedDecisions);
      setInsights(scopedInsights);
    } catch {
      toast.error("Failed to load data", "Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [user, currentDocId]);

  // Lightweight workspace-only refresh — doesn't trigger the full-page spinner
  const refreshWorkspaces = React.useCallback(async () => {
    if (!user) return;
    const data = await getWorkspacesForUser(user.uid);
    setWorkspaces(data);
  }, [user]);

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

  // ── Workspace handlers ────────────────────────────────────────────────────

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim() || isCreatingWorkspace) return;
    setIsCreatingWorkspace(true);
    try {
      await saveWorkspace(user.uid, workspaceName.trim());
      setWorkspaceName("");
      await refreshWorkspaces();
      toast.success("Workspace created");
    } catch {
      toast.error("Failed to create workspace");
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  const handleInviteMember = async (workspaceId: string) => {
    const memberId = (inviteInputs[workspaceId] ?? "").trim();
    const role = roleInputs[workspaceId] ?? "viewer";
    if (!memberId || invitingId === workspaceId) return;
    // Prevent inviting yourself
    if (memberId === user.uid) {
      toast.error("Cannot invite yourself", "You are already a member.");
      return;
    }
    // Check if already a member
    const ws = workspaces.find((w) => w.id === workspaceId);
    if (ws?.members?.some((m) => m.userId === memberId)) {
      toast.error("Already a member", "This user is already in the workspace.");
      return;
    }
    setInvitingId(workspaceId);
    try {
      await inviteWorkspaceMember(workspaceId, { userId: memberId, role });
      setInviteInputs((prev) => ({ ...prev, [workspaceId]: "" }));
      await refreshWorkspaces();
      toast.success("Member invited");
    } catch {
      toast.error("Failed to invite member");
    } finally {
      setInvitingId(null);
    }
  };

  const handleRemoveMember = async (workspaceId: string, memberUserId: string) => {
    const key = `${workspaceId}:${memberUserId}`;
    if (removingKey === key) return;
    if (!window.confirm("Remove this member from the workspace?")) return;
    setRemovingKey(key);
    try {
      await removeWorkspaceMember(workspaceId, memberUserId);
      await refreshWorkspaces();
      toast.success("Member removed");
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setRemovingKey(null);
    }
  };

  const handleDeleteWorkspace = async (workspaceId: string, name: string) => {
    if (deletingId === workspaceId) return;
    if (!window.confirm(`Delete workspace "${name}"? This cannot be undone.`)) return;
    setDeletingId(workspaceId);
    try {
      await deleteWorkspace(workspaceId);
      await refreshWorkspaces();
      toast.success("Workspace deleted");
    } catch {
      toast.error("Failed to delete workspace");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRenameWorkspace = async (workspaceId: string) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    if (isRenamingLoading) return;
    setIsRenamingLoading(true);
    try {
      await updateWorkspace(workspaceId, { name: renameValue.trim() });
      setRenamingId(null);
      setRenameValue("");
      await refreshWorkspaces();
      toast.success("Workspace renamed");
    } catch {
      toast.error("Failed to rename workspace");
    } finally {
      setIsRenamingLoading(false);
    }
  };

  // ── Outcome handler ────────────────────────────────────────────────────────

  const handleSaveOutcome = async () => {
    if (!outcomeForm || savingOutcome) return;
    setSavingOutcome(true);
    try {
      // Bug fix: use recordDecisionOutcome which writes serverTimestamp() for outcomeRecordedAt
      await recordDecisionOutcome(
        user.uid,
        outcomeForm.decisionId,
        outcomeForm.note,
        outcomeForm.success === "yes"
      );
      // Optimistic local patch so the UI updates immediately without a full reload
      setDecisions((prev) =>
        prev.map((d) =>
          d.id === outcomeForm.decisionId
            ? { ...d, outcomeNote: outcomeForm.note, success: outcomeForm.success === "yes", outcomeRecordedAt: { seconds: Date.now() / 1000 } as unknown as DecisionRecord["outcomeRecordedAt"] }
            : d
        )
      );
      setOutcomeForm(null);
      toast.success("Outcome recorded");
    } catch {
      toast.error("Failed to save outcome");
    } finally {
      setSavingOutcome(false);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const activeDoc = docs.find((d) => d.id === currentDocId) ?? null;
  const latestDecision = decisions[0] ?? null;
  const score = latestDecision?.score ?? null;

  const healthLabel = (s: number | null) => {
    if (s === null) return { text: "Unknown", cls: "text-muted-foreground" };
    if (s >= 80) return { text: "Healthy", cls: "text-emerald-600 dark:text-emerald-400" };
    if (s >= 50) return { text: "Watch", cls: "text-amber-600 dark:text-amber-400" };
    return { text: "Risk", cls: "text-red-600 dark:text-red-400" };
  };
  const health = healthLabel(score);

  const outcomeRecorded = decisions.some((d) => d.outcomeRecordedAt);
  const anyPublished = decisions.some((d) => d.published);
  const caseStatus = outcomeRecorded ? "Shipped"
    : anyPublished ? "Published"
    : decisions.length > 0 ? "Active"
    : "Draft";

  const statusCls: Record<string, string> = {
    Shipped: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    Published: "bg-primary/10 text-primary",
    Active: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    Draft: "bg-muted text-muted-foreground",
  };

  const publicProfileLink = getOriginPath(`/u/${user.uid}`);

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
            try { await navigator.clipboard.writeText(publicProfileLink); toast.success("Profile link copied"); }
            catch { toast.error("Could not copy link"); }
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
                active ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary/40" />
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
                        const scoredDecisions = docDecisions.filter((d) => typeof d.score === "number");
                        const badge = scoredDecisions.length > 0
                          ? Math.round(scoredDecisions.reduce((s, d) => s + d.score!, 0) / scoredDecisions.length)
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
                                  ? new Date(millisFromTimestamp(doc.updatedAt) as number).toLocaleDateString()
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
              <section className="rounded-xl border border-border bg-card p-5">
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
                    <span>{decisions.length} decision{decisions.length !== 1 ? "s" : ""}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusCls[caseStatus]}`}>
                      {caseStatus}
                    </span>
                  </div>
                </div>

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
                  {latestDecision?.keyInsight ? (
                    <p className="mt-3 text-[13px] text-muted-foreground border-t border-border pt-3">
                      {latestDecision.keyInsight}
                    </p>
                  ) : (
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
                      status={activeDoc ? "complete" : "pending"}
                      timestamp={millisFromTimestamp(activeDoc?.updatedAt)}
                    >
                      {activeDoc ? (
                        <div className="text-sm space-y-1">
                          <p className="font-medium">{activeDoc.title}</p>
                          <p className="text-muted-foreground text-[12px]">
                            Last updated {millisFromTimestamp(activeDoc.updatedAt)
                              ? new Date(millisFromTimestamp(activeDoc.updatedAt) as number).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                              : "—"}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No document selected — open a case from the sidebar.</p>
                      )}
                    </TimelineStep>

                    <TimelineStep
                      title="Signals Detected"
                      status={insights.length > 0 ? "active" : "pending"}
                      timestamp={millisFromTimestamp(insights[0]?.createdAt)}
                    >
                      {insights.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No signals detected — run signal extraction from the Research view.</p>
                      ) : (
                        <ul className="space-y-1">
                          {insights.map((s) => (
                            <li key={s.id} className="text-sm flex items-center gap-2">
                              <span>{s.title}</span>
                              <span className="text-[11px] text-muted-foreground capitalize">{s.category?.replace("-", " ")}</span>
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
                                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/case/${d.id}`).then(() => toast.success("Link copied")).catch(() => {})}
                                    title="Copy public link"
                                  >
                                    <Globe className="h-3 w-3" />
                                    <Link2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              {d.justification && (
                                <p className="mt-1 text-[12px] text-muted-foreground line-clamp-2">{d.justification}</p>
                              )}
                              {d.tradeoffs && (
                                <p className="mt-1 text-[11px] text-muted-foreground/70 italic line-clamp-1">Tradeoffs: {d.tradeoffs}</p>
                              )}
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
                                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/case/${decisions[0].id}`).then(() => toast.success("Link copied")).catch(() => {})}
                                title="Copy public link"
                              >
                                <Globe className="h-3 w-3" /> Copy link
                              </button>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {decisions[0].score !== undefined ? `Score: ${decisions[0].score} · ` : ""}Confidence: {decisions[0].confidence ?? "—"}
                          </p>
                          <p className="mt-2 text-sm">{decisions[0].justification}</p>
                        </div>
                      )}
                    </TimelineStep>

                    <TimelineStep
                      title="Outcome"
                      status={outcomeRecorded ? "complete" : decisions.length > 0 ? "active" : "pending"}
                      timestamp={millisFromTimestamp(decisions.find((d) => d.outcomeRecordedAt)?.outcomeRecordedAt)}
                    >
                      {outcomeRecorded ? (
                        <div className="space-y-2">
                          {decisions.filter((d) => d.outcomeRecordedAt).map((d) => (
                            <div key={d.id} className="rounded-lg border border-border bg-background p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium">{d.title}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  d.success
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                }`}>
                                  {d.success ? "Success" : "Missed"}
                                </span>
                              </div>
                              {d.outcomeNote && <p className="text-[12px] text-muted-foreground">{d.outcomeNote}</p>}
                            </div>
                          ))}
                        </div>
                      ) : decisions.length > 0 ? (
                        outcomeForm ? (
                          <div className="space-y-3">
                            <div>
                              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Result</label>
                              <select
                                value={outcomeForm.success}
                                onChange={(e) => setOutcomeForm({ ...outcomeForm, success: e.target.value as "yes" | "no" | "partial" })}
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                              >
                                <option value="yes">Success — target met or exceeded</option>
                                <option value="partial">Partial — some goals met</option>
                                <option value="no">Missed — target not reached</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">What actually happened</label>
                              <textarea
                                value={outcomeForm.note}
                                onChange={(e) => setOutcomeForm({ ...outcomeForm, note: e.target.value })}
                                placeholder="Describe the actual result, metrics observed, and key learnings…"
                                rows={3}
                                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveOutcome} disabled={savingOutcome}>
                                {savingOutcome ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Saving…</> : "Record Outcome"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setOutcomeForm(null)} disabled={savingOutcome}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Outcomes and metrics will appear here once recorded.</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setOutcomeForm({ decisionId: decisions[0].id!, note: "", success: "yes" })}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                              Record Outcome
                            </Button>
                          </div>
                        )
                      ) : (
                        <p className="text-sm text-muted-foreground">Make a decision first to record its outcome.</p>
                      )}
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
            inviteInputs={inviteInputs}
            roleInputs={roleInputs}
            renamingId={renamingId}
            renameValue={renameValue}
            isCreatingWorkspace={isCreatingWorkspace}
            invitingId={invitingId}
            removingKey={removingKey}
            deletingId={deletingId}
            isRenamingLoading={isRenamingLoading}
            onWorkspaceNameChange={setWorkspaceName}
            onInviteInputChange={(wsId, val) => setInviteInputs((p) => ({ ...p, [wsId]: val }))}
            onRoleInputChange={(wsId, role) => setRoleInputs((p) => ({ ...p, [wsId]: role }))}
            onCreateWorkspace={handleCreateWorkspace}
            onInviteMember={handleInviteMember}
            onRemoveMember={handleRemoveMember}
            onDeleteWorkspace={handleDeleteWorkspace}
            onStartRename={(wsId, name) => { setRenamingId(wsId); setRenameValue(name); }}
            onRenameChange={setRenameValue}
            onConfirmRename={handleRenameWorkspace}
            onCancelRename={() => { setRenamingId(null); setRenameValue(""); }}
          />
        )}
      </div>
    </div>
  );
}

// ── TimelineStep ──────────────────────────────────────────────────────────────

function TimelineStep({
  title, status, timestamp, children,
}: {
  title: string;
  status: "pending" | "active" | "complete";
  timestamp?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  const dotCls =
    status === "complete" ? "bg-emerald-500"
    : status === "active" ? "bg-amber-500"
    : "bg-muted-foreground/25 border border-border";

  return (
    <div className="relative">
      <div className={`absolute -left-[29px] top-3.5 h-3 w-3 rounded-full ${dotCls}`} />
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <h4 className="text-sm font-medium">{title}</h4>
            {timestamp && (
              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                {new Date(timestamp).toLocaleDateString()}
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

// ── WorkspaceSection ──────────────────────────────────────────────────────────

interface WorkspaceSectionProps {
  userId: string;
  workspaces: (TeamWorkspace & { id: string })[];
  workspaceName: string;
  inviteInputs: Record<string, string>;
  roleInputs: Record<string, "editor" | "viewer">;
  renamingId: string | null;
  renameValue: string;
  isCreatingWorkspace: boolean;
  invitingId: string | null;
  removingKey: string | null;
  deletingId: string | null;
  isRenamingLoading: boolean;
  onWorkspaceNameChange: (v: string) => void;
  onInviteInputChange: (wsId: string, val: string) => void;
  onRoleInputChange: (wsId: string, role: "editor" | "viewer") => void;
  onCreateWorkspace: () => void;
  onInviteMember: (wsId: string) => void;
  onRemoveMember: (wsId: string, userId: string) => void;
  onDeleteWorkspace: (wsId: string, name: string) => void;
  onStartRename: (wsId: string, name: string) => void;
  onRenameChange: (v: string) => void;
  onConfirmRename: (wsId: string) => void;
  onCancelRename: () => void;
}

function WorkspaceSection({
  userId, workspaces, workspaceName, inviteInputs, roleInputs,
  renamingId, renameValue,
  isCreatingWorkspace, invitingId, removingKey, deletingId, isRenamingLoading,
  onWorkspaceNameChange, onInviteInputChange, onRoleInputChange,
  onCreateWorkspace, onInviteMember, onRemoveMember, onDeleteWorkspace,
  onStartRename, onRenameChange, onConfirmRename, onCancelRename,
}: WorkspaceSectionProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      {/* Create workspace panel */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Workspace Dashboard</p>
          <h3 className="mt-2 text-base font-semibold">Create a team workspace</h3>
        </div>
        <Input
          value={workspaceName}
          onChange={(e) => onWorkspaceNameChange(e.target.value)}
          placeholder="Workspace name"
          disabled={isCreatingWorkspace}
          onKeyDown={(e) => e.key === "Enter" && onCreateWorkspace()}
        />
        <Button
          onClick={onCreateWorkspace}
          disabled={!workspaceName.trim() || isCreatingWorkspace}
          className="w-full"
        >
          {isCreatingWorkspace
            ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Creating…</>
            : <><Plus className="h-3.5 w-3.5 mr-1.5" />Create Workspace</>
          }
        </Button>
        <p className="text-xs text-muted-foreground">Owners manage membership; editors and viewers can inspect shared work.</p>
      </section>

      {/* Workspaces list panel */}
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
          <div className="space-y-4">
            {workspaces.map((workspace) => {
              const myRole = (workspace.members ?? []).find((m) => m.userId === userId)?.role ?? "viewer";
              const isOwner = myRole === "owner";
              const isRenaming = renamingId === workspace.id;
              const isDeleting = deletingId === workspace.id;

              return (
                <div key={workspace.id} className="rounded-lg border border-border p-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={renameValue}
                            onChange={(e) => onRenameChange(e.target.value)}
                            className="h-7 text-sm"
                            autoFocus
                            disabled={isRenamingLoading}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") onConfirmRename(workspace.id);
                              if (e.key === "Escape") onCancelRename();
                            }}
                          />
                          <button
                            onClick={() => onConfirmRename(workspace.id)}
                            disabled={isRenamingLoading}
                            className="text-primary hover:opacity-80 disabled:opacity-40"
                          >
                            {isRenamingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          </button>
                          <button onClick={onCancelRename} disabled={isRenamingLoading} className="text-muted-foreground hover:opacity-80 disabled:opacity-40">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm font-semibold">{workspace.name}</p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {(workspace.members ?? []).length} member{(workspace.members ?? []).length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] bg-muted text-muted-foreground">
                        {myRole}
                      </span>
                      {isOwner && !isRenaming && (
                        <>
                          <button
                            onClick={() => onStartRename(workspace.id, workspace.name)}
                            disabled={isDeleting}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                            title="Rename workspace"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteWorkspace(workspace.id, workspace.name)}
                            disabled={isDeleting}
                            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                            title="Delete workspace"
                          >
                            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Members list */}
                  {(workspace.members ?? []).length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Members</p>
                      {(workspace.members ?? []).map((member) => {
                        const key = `${workspace.id}:${member.userId}`;
                        const isRemoving = removingKey === key;
                        return (
                          <div key={member.userId} className="flex items-center justify-between gap-2 py-1 border-b border-border/40 last:border-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="text-xs font-mono text-muted-foreground truncate max-w-[160px]"
                                title={member.userId}
                              >
                                {member.userId === userId ? "You" : member.userId.slice(0, 12) + "…"}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                                {member.role}
                              </span>
                            </div>
                            {isOwner && member.userId !== userId && (
                              <button
                                onClick={() => onRemoveMember(workspace.id, member.userId)}
                                disabled={isRemoving}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 disabled:opacity-40"
                                title="Remove member"
                              >
                                {isRemoving
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <UserMinus className="h-3.5 w-3.5" />
                                }
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Invite section — owners only */}
                  {isOwner && (
                    <div className="pt-1 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Invite member</p>
                      <p className="text-[11px] text-muted-foreground/70">Enter the member's Speckula user ID (shown in their profile URL).</p>
                      <div className="flex gap-2">
                        <Input
                          value={inviteInputs[workspace.id] ?? ""}
                          onChange={(e) => onInviteInputChange(workspace.id, e.target.value)}
                          placeholder="User ID"
                          className="flex-1 h-8 text-sm"
                          disabled={invitingId === workspace.id}
                          onKeyDown={(e) => e.key === "Enter" && onInviteMember(workspace.id)}
                        />
                        <select
                          value={roleInputs[workspace.id] ?? "viewer"}
                          onChange={(e) => onRoleInputChange(workspace.id, e.target.value as "editor" | "viewer")}
                          disabled={invitingId === workspace.id}
                          className="h-8 rounded-md border border-border bg-background px-2 text-sm shrink-0 disabled:opacity-50"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0"
                          onClick={() => onInviteMember(workspace.id)}
                          disabled={!(inviteInputs[workspace.id] ?? "").trim() || invitingId === workspace.id}
                        >
                          {invitingId === workspace.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : "Invite"
                          }
                        </Button>
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground/60 italic border-t border-border/40 pt-2">
                    Shared document and decision access coming soon.
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
