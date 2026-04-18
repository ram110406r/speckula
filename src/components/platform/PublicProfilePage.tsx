"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Sparkles, SquareArrowOutUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicProfile, getPublicCasesByUser, type PublicCase, type PublicProfile } from "@/lib/firebase/db";

export function PublicProfilePage({ userId }: { userId: string }) {
  const [profile, setProfile] = React.useState<PublicProfile | null>(null);
  const [cases, setCases] = React.useState<(PublicCase & { id: string })[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [profileData, caseData] = await Promise.all([getPublicProfile(userId), getPublicCasesByUser(userId, false)]);
        setProfile(profileData);
        setCases(caseData);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId]);

  const scoreAverage = profile?.scoreAverage ?? (cases.length ? Math.round(cases.reduce((sum, item) => sum + item.score, 0) / cases.length) : 0);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><p className="label-system text-[12px] text-muted-foreground">Loading public profile...</p></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/60 bg-white/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="inline-flex items-center gap-2 label-system text-[12px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <Button variant="outline" size="sm" className="label-system text-[12px]" onClick={() => navigator.clipboard.writeText(window.location.href)}>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Link
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <section className="rounded-3xl border border-border/60 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Public Product Portfolio</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">{profile?.name || userId}</h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{profile?.bio || "This profile has not been completed yet."}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {(profile?.skills || []).map((skill) => (
                  <span key={skill} className="rounded-full border border-border/60 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{skill}</span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-right min-w-[180px]">
              <p className="label-system text-[10px] uppercase tracking-[0.24em] text-primary">Average Score</p>
              <p className="mt-2 text-4xl font-semibold text-foreground">{scoreAverage}</p>
              <p className="mt-1 text-xs text-muted-foreground">Across public product cases</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Metric label="Public Cases" value={cases.length.toString()} />
          <Metric label="Thinking Depth" value={cases.length ? "Visible" : "Pending"} />
          <Metric label="Outcome Evidence" value={cases.some((item) => Boolean(item.outcome)) ? "Recorded" : "Missing"} />
        </section>

        <section className="rounded-3xl border border-border/60 bg-white p-8 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Featured Cases</p>
              <h2 className="mt-2 text-xl font-semibold">Thinking, score, and outcome</h2>
            </div>
            <Sparkles className="h-4 w-4 text-primary/60" />
          </div>

          {cases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/40 p-12 text-center">
              <p className="label-system text-[12px]">No public cases yet</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {cases.map((item) => (
                <article key={item.id} className="rounded-2xl border border-border/60 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{item.content}</p>
                    </div>
                    <Link href={`/c/${item.id}`} className="inline-flex items-center gap-1 rounded-md border border-border/60 px-3 py-2 text-[12px] hover:border-primary/40 hover:text-primary">
                      Open <SquareArrowOutUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <SmallStat label="Score" value={item.score.toString()} />
                    <SmallStat label="Visibility" value={item.visibility} />
                    <SmallStat label="Outcome" value={item.outcome && Object.keys(item.outcome).length > 0 ? "Recorded" : "Pending"} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white p-5 text-center shadow-sm">
      <p className="label-system text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-3">
      <p className="label-system text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}