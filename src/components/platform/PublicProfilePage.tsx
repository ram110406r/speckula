"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicProfile, type PublicProfile } from "@/lib/firebase/db";

export function PublicProfilePage({ userId }: { userId: string }) {
  const [profile, setProfile] = React.useState<PublicProfile | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const profileData = await getPublicProfile(userId);
        setProfile(profileData);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId]);

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
          <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Public Profile</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{profile?.name || userId}</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{profile?.bio || "This profile has not been completed yet."}</p>
          {(profile?.skills?.length ?? 0) > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {(profile?.skills || []).map((skill) => (
                <span key={skill} className="rounded-full border border-border/60 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{skill}</span>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
