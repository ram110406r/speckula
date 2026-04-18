"use client";

import React from "react";
import Link from "next/link";
import { Activity, ArrowRight, Copy, Globe, Network, Shield, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import {
  getDecisions,
  getPublicCases,
  getPublicCasesByUser,
  getPublicProfile,
  getPublicProfiles,
  getWorkspacesForUser,
  inviteWorkspaceMember,
  savePublicCase,
  savePublicProfile,
  saveWorkspace,
  updatePublicCase,
  type DecisionRecord,
  type PublicCase,
  type PublicProfile,
  type TeamWorkspace,
} from "@/lib/firebase/db";

type PlatformTab = "portfolio" | "cases" | "workspaces" | "recruiter" | "network";

const tabs: Array<{ id: PlatformTab; label: string; icon: React.ElementType }> = [
  { id: "portfolio", label: "Portfolio", icon: Sparkles },
  { id: "cases", label: "Cases", icon: Globe },
  { id: "workspaces", label: "Workspaces", icon: Users },
  { id: "recruiter", label: "Recruiter", icon: Shield },
  { id: "network", label: "Network", icon: Network },
];

function averageScore(cases: PublicCase[]) {
  if (cases.length === 0) return 0;
  return Math.round(cases.reduce((sum, item) => sum + (item.score || 0), 0) / cases.length);
}

function profileUrl(userId: string) {
  return `/u/${userId}`;
}

function caseUrl(caseId: string) {
  return `/c/${caseId}`;
}

function getOriginPath(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function PlatformView() {
  const { user } = useAuth();
  const { setActiveView } = useAppStore();
  const [activeTab, setActiveTab] = React.useState<PlatformTab>("portfolio");
  const [profile, setProfile] = React.useState<PublicProfile | null>(null);
  const [ownCases, setOwnCases] = React.useState<(PublicCase & { id: string })[]>([]);
  const [publicCases, setPublicCases] = React.useState<(PublicCase & { id: string })[]>([]);
  const [profiles, setProfiles] = React.useState<(PublicProfile & { id: string })[]>([]);
  const [workspaces, setWorkspaces] = React.useState<(TeamWorkspace & { id: string })[]>([]);
  const [decisions, setDecisions] = React.useState<DecisionRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [publishingCaseId, setPublishingCaseId] = React.useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [inviteTarget, setInviteTarget] = React.useState("");
  const [caseTitle, setCaseTitle] = React.useState("");
  const [caseContent, setCaseContent] = React.useState("");
  const [caseScore, setCaseScore] = React.useState("72");
  const [caseOutcome, setCaseOutcome] = React.useState("");
  const [caseVisibility, setCaseVisibility] = React.useState<"public" | "private">("public");
  const [profileName, setProfileName] = React.useState("");
  const [profileBio, setProfileBio] = React.useState("");
  const [profileSkills, setProfileSkills] = React.useState("");
  const [recruiterQuery, setRecruiterQuery] = React.useState("");

  const loadPlatformData = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [profileData, ownCaseData, publicCaseData, publicProfileData, workspaceData, decisionData] = await Promise.all([
        getPublicProfile(user.uid),
        getPublicCasesByUser(user.uid, true),
        getPublicCases(),
        getPublicProfiles(),
        getWorkspacesForUser(user.uid),
        getDecisions(user.uid),
      ]);

      setProfile(profileData);
      setOwnCases(ownCaseData);
      setPublicCases(publicCaseData);
      setProfiles(publicProfileData);
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
        <div className="max-w-md rounded-2xl border border-border/60 bg-white p-8 text-center shadow-sm">
          <Users className="mx-auto h-10 w-10 text-primary/50" />
          <h1 className="mt-4 text-lg font-semibold">Platform mode needs a signed-in user.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Use Google sign-in to build your public profile, publish cases, and collaborate in workspaces.</p>
        </div>
      </div>
    );
  }

  const myPublicCases = ownCases.filter((item) => item.visibility === "public");
  const recruiterMatches = profiles.filter((item) => {
    if (!recruiterQuery.trim()) return true;
    const query = recruiterQuery.toLowerCase();
    return item.name.toLowerCase().includes(query) || item.skills.some((skill) => skill.toLowerCase().includes(query));
  });

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const skills = profileSkills
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

      const nextProfile = {
        userId: user.uid,
        name: profileName.trim(),
        bio: profileBio.trim(),
        skills,
        publicCases: myPublicCases.map((item) => item.id),
        scoreAverage: averageScore(myPublicCases),
      };

      await savePublicProfile(user.uid, nextProfile);
      await loadPlatformData();
    } catch (error) {
      console.error("Failed to save public profile:", error);
      alert("Failed to save your public profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePublishDecision = async (decision: DecisionRecord) => {
    if (publishingCaseId) return;

    const content = [
      `Decision: ${decision.title}`,
      `Why: ${decision.justification}`,
      `Priority: ${decision.priority}`,
      `Impact: ${decision.impact}`,
      `Effort: ${decision.effort}`,
      `Tradeoffs: ${decision.tradeoffs}`,
      decision.strategyTheme ? `Theme: ${decision.strategyTheme}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    setPublishingCaseId(decision.id ?? decision.title);
    try {
      const priorityBonus = decision.priority === "high" ? 20 : decision.priority === "medium" ? 10 : 0;
      const score = Math.max(0, Math.min(100, Math.round(decision.impact * 10 + (10 - decision.effort) * 5 + priorityBonus)));
      const caseId = await savePublicCase({
        caseId: decision.id,
        userId: user.uid,
        title: decision.title,
        content,
        score,
        outcome: { source: "decision", decisionId: decision.id ?? null },
        visibility: "public",
      });

      const refreshedCases = await getPublicCasesByUser(user.uid, true);
      await savePublicProfile(user.uid, {
        userId: user.uid,
        name: profileName.trim(),
        bio: profileBio.trim(),
        skills: profileSkills.split(",").map((entry) => entry.trim()).filter(Boolean),
        publicCases: refreshedCases.filter((item) => item.visibility === "public").map((item) => item.id),
        scoreAverage: averageScore(refreshedCases.filter((item) => item.visibility === "public")),
      });

      if (caseId) {
        setActiveView("platform");
      }
      await loadPlatformData();
    } catch (error) {
      console.error("Failed to publish decision:", error);
      alert("Failed to publish this decision as a public case.");
    } finally {
      setPublishingCaseId(null);
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

  const handleCreateCase = async () => {
    if (!caseTitle.trim() || !caseContent.trim()) return;
    try {
      const numericScore = Number(caseScore) || 0;
      const newId = await savePublicCase({
        userId: user.uid,
        title: caseTitle.trim(),
        content: caseContent.trim(),
        score: numericScore,
        outcome: caseOutcome.trim() ? { summary: caseOutcome.trim() } : {},
        visibility: caseVisibility,
      });
      setCaseTitle("");
      setCaseContent("");
      setCaseOutcome("");
      setCaseScore("72");
      setCaseVisibility("public");
      await savePublicProfile(user.uid, {
        userId: user.uid,
        name: profileName.trim(),
        bio: profileBio.trim(),
        skills: profileSkills.split(",").map((entry) => entry.trim()).filter(Boolean),
        publicCases: [...new Set([...myPublicCases.map((item) => item.id), newId])],
        scoreAverage: averageScore([...myPublicCases, { id: newId, userId: user.uid, title: caseTitle, content: caseContent, score: numericScore, outcome: {}, visibility: caseVisibility, createdAt: null, updatedAt: null }]),
      });
      await loadPlatformData();
    } catch (error) {
      console.error("Failed to create public case:", error);
      alert("Failed to create public case.");
    }
  };

  const handleToggleVisibility = async (item: PublicCase & { id: string }) => {
    const nextVisibility = item.visibility === "public" ? "private" : "public";
    try {
      await updatePublicCase(item.id, { visibility: nextVisibility });
      await loadPlatformData();
    } catch (error) {
      console.error("Failed to update visibility:", error);
    }
  };

  const publicCaseLinks = myPublicCases.map((item) => getOriginPath(caseUrl(item.id)));
  const publicProfileLink = getOriginPath(profileUrl(user.uid));

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border/60 bg-white/60 px-8 h-14 shrink-0">
        <div className="flex items-center gap-3">
          <Network className="h-4 w-4 text-primary" />
          <span className="label-system text-[12px]">Platform Mode</span>
          <span className="label-system text-[12px] bg-muted/20 px-2 py-0.5 rounded-sm">{publicCases.filter((item) => item.visibility === "public").length} public cases</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-8 label-system text-[12px]" onClick={() => navigator.clipboard.writeText(publicProfileLink)}>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Profile Link
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border/40 bg-white/20 px-8 py-3 shrink-0 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 label-system text-[12px] transition-all ${
                active ? "border-primary bg-primary text-white" : "border-border/60 bg-white hover:border-primary/40 hover:text-foreground"
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
          <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-border/40 bg-white">
            <div className="text-center">
              <Activity className="mx-auto h-8 w-8 animate-pulse text-primary/40" />
              <p className="mt-3 label-system text-[12px]">Loading platform network</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "portfolio" && (
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-6">
                  <section className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Public Profile</p>
                        <h2 className="mt-2 text-lg font-semibold">{profileName || user.displayName || "Builder Profile"}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Share product thinking, case history, and outcome evidence.</p>
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
                      <span className="label-system text-[12px] text-muted-foreground">Average opportunity score: {averageScore(myPublicCases)}</span>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Decision Publishing</p>
                        <h3 className="mt-2 text-base font-semibold">Turn decisions into public cases</h3>
                      </div>
                      <span className="label-system text-[12px] text-muted-foreground">{decisions.length} decisions</span>
                    </div>
                    {decisions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Generate decisions first, then publish the strongest ones as shareable cases.</p>
                    ) : (
                      <div className="space-y-3">
                        {decisions.slice(0, 4).map((decision) => (
                          <div key={decision.id ?? decision.title} className="rounded-xl border border-border/60 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm font-semibold">{decision.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{decision.justification}</p>
                              </div>
                              <Button size="sm" variant="outline" className="label-system text-[12px]" onClick={() => handlePublishDecision(decision)} disabled={publishingCaseId === (decision.id ?? decision.title)}>
                                {publishingCaseId === (decision.id ?? decision.title) ? "Publishing..." : "Publish"}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <div className="space-y-6">
                  <section className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Network Snapshot</p>
                        <h3 className="mt-2 text-base font-semibold">Relationships at a glance</h3>
                      </div>
                      <span className="label-system text-[12px] text-muted-foreground">{profiles.length} profiles</span>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                      <StatCard label="Cases" value={myPublicCases.length.toString()} />
                      <StatCard label="Workspaces" value={workspaces.length.toString()} />
                      <StatCard label="Avg Score" value={averageScore(publicCases.filter((item) => item.visibility === "public")).toString()} />
                    </div>
                    <NetworkGraph publicCases={myPublicCases} />
                  </section>

                  <section className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm space-y-4">
                    <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Share Links</p>
                    <div className="space-y-2">
                      <CopyRow label="Profile" value={publicProfileLink} />
                      {publicCaseLinks.slice(0, 3).map((link) => (
                        <CopyRow key={link} label="Case" value={link} />
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {activeTab === "cases" && (
              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <section className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Public Case Builder</p>
                      <h3 className="mt-2 text-base font-semibold">Publish a product case</h3>
                    </div>
                    <Button size="sm" variant="ghost" className="label-system text-[12px]" onClick={() => setActiveView("decisions")}>
                      Review decisions
                    </Button>
                  </div>
                  <Input value={caseTitle} onChange={(event) => setCaseTitle(event.target.value)} placeholder="Case title" />
                  <Textarea value={caseContent} onChange={(event) => setCaseContent(event.target.value)} placeholder="Thinking, evidence, and tradeoffs" className="min-h-[140px]" />
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input value={caseScore} onChange={(event) => setCaseScore(event.target.value)} placeholder="Score" />
                    <Input value={caseOutcome} onChange={(event) => setCaseOutcome(event.target.value)} placeholder="Outcome summary" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant={caseVisibility === "public" ? "default" : "outline"} size="sm" onClick={() => setCaseVisibility("public")}>Public</Button>
                    <Button variant={caseVisibility === "private" ? "default" : "outline"} size="sm" onClick={() => setCaseVisibility("private")}>Private</Button>
                  </div>
                  <Button onClick={handleCreateCase} className="w-full">Publish Case</Button>
                </section>

                <section className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Case Registry</p>
                      <h3 className="mt-2 text-base font-semibold">Your case history</h3>
                    </div>
                    <span className="label-system text-[12px] text-muted-foreground">{ownCases.length} items</span>
                  </div>
                  <div className="space-y-3">
                    {ownCases.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No cases yet. Publish one to start building your portfolio.</p>
                    ) : (
                      ownCases.map((item) => (
                        <div key={item.id} className="rounded-xl border border-border/60 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold">{item.title}</p>
                                <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{item.visibility}</span>
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{item.content}</p>
                              <p className="mt-2 text-xs text-muted-foreground">Score {item.score}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Link href={caseUrl(item.id)} className="inline-flex items-center justify-center rounded-md border border-border/60 px-3 py-2 text-[12px] hover:border-primary/40 hover:text-primary">
                                Open
                              </Link>
                              <Button size="sm" variant="outline" onClick={() => handleToggleVisibility(item)}>
                                Make {item.visibility === "public" ? "Private" : "Public"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}

            {activeTab === "workspaces" && (
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

            {activeTab === "recruiter" && (
              <RecruiterSection
                query={recruiterQuery}
                profiles={recruiterMatches}
                publicCases={publicCases}
                onQueryChange={setRecruiterQuery}
              />
            )}

            {activeTab === "network" && (
              <section className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Collaboration Graph</p>
                    <h3 className="mt-2 text-base font-semibold">User → Case → Outcome connections</h3>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                    <span>{profiles.length} people</span>
                    <span>{publicCases.filter((item) => item.visibility === "public").length} cases</span>
                    <span>{workspaces.length} workspaces</span>
                  </div>
                </div>
                <NetworkGraph publicCases={publicCases.filter((item) => item.visibility === "public")} />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-4">
      <p className="label-system text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3">
      <div className="min-w-0">
        <p className="label-system text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <p className="truncate text-xs text-foreground">{value}</p>
      </div>
      <button onClick={handleCopy} className="label-system text-[12px] text-primary hover:underline">{copied ? "Copied" : "Copy"}</button>
    </div>
  );
}

function NetworkGraph({ publicCases }: { publicCases: (PublicCase & { id: string })[] }) {
  const nodes = publicCases.slice(0, 6);
  const width = 560;
  const height = 280;

  return (
    <div className="mt-6 rounded-2xl border border-border/60 bg-gradient-to-br from-white to-primary/5 p-4 overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full">
        <defs>
          <linearGradient id="platformLine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c9b7e8" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>
        </defs>
        <circle cx={width / 2} cy={height / 2} r="42" fill="white" stroke="url(#platformLine)" strokeWidth="2" />
        <text x={width / 2} y={height / 2 + 5} textAnchor="middle" className="fill-foreground" style={{ fontSize: 12, fontWeight: 700 }}>
          You
        </text>
        {nodes.map((item, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1) - Math.PI / 2;
          const radius = 95;
          const x = width / 2 + Math.cos(angle) * radius;
          const y = height / 2 + Math.sin(angle) * radius;
          return (
            <g key={item.id}>
              <line x1={width / 2} y1={height / 2} x2={x} y2={y} stroke="url(#platformLine)" strokeWidth="1.5" opacity="0.75" />
              <circle cx={x} cy={y} r="24" fill="white" stroke="#d9d6ea" />
              <text x={x} y={y - 2} textAnchor="middle" className="fill-foreground" style={{ fontSize: 10, fontWeight: 600 }}>
                Case
              </text>
              <text x={x} y={y + 10} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 8 }}>
                {item.score}
              </text>
            </g>
          );
        })}
      </svg>
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
      <section className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm space-y-4">
        <div>
          <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Workspace Dashboard</p>
          <h3 className="mt-2 text-base font-semibold">Create a team workspace</h3>
        </div>
        <Input value={workspaceName} onChange={(event) => onWorkspaceNameChange(event.target.value)} placeholder="Workspace name" />
        <Button onClick={onCreateWorkspace} className="w-full">Create Workspace</Button>
        <p className="text-xs text-muted-foreground">Owners can manage membership and shared cases. Viewers can inspect cases and comments.</p>
      </section>

      <section className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Shared Workspaces</p>
            <h3 className="mt-2 text-base font-semibold">Collaboration hubs</h3>
          </div>
          <span className="label-system text-[12px] text-muted-foreground">{workspaces.length}</span>
        </div>

        {workspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workspaces yet. Create one to start sharing cases.</p>
        ) : (
          <div className="space-y-3">
            {workspaces.map((workspace) => (
              <div key={workspace.id} className="rounded-xl border border-border/60 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{workspace.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{workspace.members.length} members, {workspace.cases.length} cases</p>
                  </div>
                  <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{workspace.members.find((member) => member.userId === userId)?.role ?? "viewer"}</span>
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

function RecruiterSection({
  query,
  profiles,
  publicCases,
  onQueryChange,
}: {
  query: string;
  profiles: (PublicProfile & { id: string })[];
  publicCases: (PublicCase & { id: string })[];
  onQueryChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm space-y-4">
        <div>
          <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Recruiter Mode</p>
          <h3 className="mt-2 text-base font-semibold">Search by skill or name</h3>
        </div>
        <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search product, strategy, research" />
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Profiles" value={profiles.length.toString()} />
          <Metric label="Public Cases" value={publicCases.filter((item) => item.visibility === "public").length.toString()} />
          <Metric label="Avg Score" value={averageScore(publicCases.filter((item) => item.visibility === "public")).toString()} />
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Candidate Pool</p>
            <h3 className="mt-2 text-base font-semibold">Real work, not resumes</h3>
          </div>
          <span className="label-system text-[12px] text-muted-foreground">{profiles.length}</span>
        </div>

        {profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching profiles yet.</p>
        ) : (
          <div className="space-y-3">
            {profiles.map((profile) => (
              <div key={profile.id} className="rounded-xl border border-border/60 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{profile.name || profile.userId}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{profile.bio || "No bio yet."}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {profile.skills.slice(0, 4).map((skill) => (
                        <span key={skill} className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{skill}</span>
                      ))}
                    </div>
                  </div>
                  <Link href={profileUrl(profile.userId)} className="inline-flex items-center gap-1 rounded-md border border-border/60 px-3 py-2 text-[12px] hover:border-primary/40 hover:text-primary">
                    View <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-4 text-center">
      <p className="label-system text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}