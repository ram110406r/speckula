"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Copy, Network, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  getDecisions,
  getPublicProfile,
  getWorkspacesForUser,
  inviteWorkspaceMember,
  savePublicProfile,
  saveWorkspace,
  type DecisionRecord,
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
  const [activeTab, setActiveTab] = React.useState<PlatformTab>("portfolio");
  const [workspaces, setWorkspaces] = React.useState<(TeamWorkspace & { id: string })[]>([]);
  const [decisions, setDecisions] = React.useState<DecisionRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [inviteTarget, setInviteTarget] = React.useState("");
  const [profileName, setProfileName] = React.useState("");
  const [profileBio, setProfileBio] = React.useState("");
  const [profileSkills, setProfileSkills] = React.useState("");

  const loadPlatformData = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [profileData, workspaceData, decisionData] = await Promise.all([
        getPublicProfile(user.uid),
        getWorkspacesForUser(user.uid),
        getDecisions(user.uid),
      ]);

      setWorkspaces(workspaceData);
      setDecisions(decisionData);
      setProfileName(profileData?.name ?? user.displayName ?? "");
      setProfileBio(profileData?.bio ?? "");
      setProfileSkills(profileData?.skills?.join(", ") ?? "");
    } catch (error) {
      console.error("Failed to load platform data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

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

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const skills = profileSkills
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

      await savePublicProfile(user.uid, {
        userId: user.uid,
        name: profileName.trim(),
        bio: profileBio.trim(),
        skills,
      });
      await loadPlatformData();
    } catch (error) {
      console.error("Failed to save public profile:", error);
      alert("Failed to save your public profile.");
    } finally {
      setSavingProfile(false);
    }
  };

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

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border/60 bg-card/60 px-8 h-14 shrink-0">
        <div className="flex items-center gap-3">
          <Network className="h-4 w-4 text-primary" />
          <span className="label-system text-[12px]">Platform Mode</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-8 label-system text-[12px]" onClick={() => navigator.clipboard.writeText(publicProfileLink)}>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Profile Link
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border/40 bg-card/20 px-8 py-3 shrink-0 overflow-x-auto">
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

      <div className="flex-1 overflow-auto p-8 custom-scrollbar space-y-8">
        {isLoading ? (
          <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-border/40 bg-card">
            <p className="label-system text-[12px] text-muted-foreground">Loading platform</p>
          </div>
        ) : activeTab === "portfolio" ? (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Public Profile</p>
                  <h2 className="mt-2 text-lg font-semibold">{profileName || user.displayName || "Builder Profile"}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">A lightweight, shareable summary of your product practice.</p>
                </div>
                <Link href={profileUrl(user.uid)} className="inline-flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 label-system text-[12px] hover:border-primary/40 hover:text-primary">
                  Open Profile <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="label-system text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Name</p>
                  <Input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Your public name" className="mt-2" />
                </div>
                <div>
                  <p className="label-system text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Skills</p>
                  <Input value={profileSkills} onChange={(event) => setProfileSkills(event.target.value)} placeholder="Product, Research, Strategy" className="mt-2" />
                </div>
                <div className="md:col-span-2">
                  <p className="label-system text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Bio</p>
                  <Textarea value={profileBio} onChange={(event) => setProfileBio(event.target.value)} placeholder="Short public summary of your product practice" className="mt-2 min-h-[110px]" />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button onClick={handleSaveProfile} disabled={savingProfile} className="label-system text-[12px]">
                  {savingProfile ? "Saving..." : "Save Public Profile"}
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Decision History</p>
                  <h3 className="mt-2 text-base font-semibold">Your private decision log</h3>
                </div>
                <span className="label-system text-[12px] text-muted-foreground">{decisions.length} decisions</span>
              </div>
              {decisions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No decisions yet — generate your first one in the Decisions view.</p>
              ) : (
                <div className="space-y-3">
                  {decisions.slice(0, 6).map((decision) => (
                    <div key={decision.id ?? decision.title} className="rounded-xl border border-border/60 p-4">
                      <p className="text-sm font-semibold">{decision.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{decision.justification}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
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
