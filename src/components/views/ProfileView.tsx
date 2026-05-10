"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  User, Globe, Camera,
  Check, Shield, LogOut, Trash2, Clock,
} from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";

function SavedBadge({ visible }: { visible: boolean }) {
  return (
    <span className={`text-[10px] text-green-500 font-medium flex items-center gap-1 transition-all duration-200 ${visible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      <Check className="h-3 w-3" /> Saved
    </span>
  );
}

function FieldRow({ label, hint, children, savedKey, savedStates }: {
  label: string; hint?: string;
  children: React.ReactNode;
  savedKey?: string;
  savedStates?: Record<string, boolean>;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6 py-4 border-b border-border/40 last:border-0">
      <div className="sm:w-40 shrink-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1">{children}</div>
        {savedKey && savedStates && <SavedBadge visible={!!savedStates[savedKey]} />}
      </div>
    </div>
  );
}

const INPUT_CLS = "w-full h-8 px-3 rounded-lg border border-border/60 bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors";

const SESSIONS = [
  { device: "Chrome on macOS", location: "London, UK",     ip: "82.x.x.x",  time: "Now (current)",  current: true  },
  { device: "Safari on iPhone", location: "London, UK",    ip: "82.x.x.x",  time: "2h ago",          current: false },
  { device: "Chrome on Windows", location: "New York, US", ip: "174.x.x.x", time: "3 days ago",      current: false },
];

export function ProfileView() {
  const { user, logout } = useAuth();

  const [form, setForm] = useState({
    displayName: user?.displayName ?? "",
    email:       user?.email ?? "",
    role:        "Product Manager",
    company:     "Acme Corp",
    location:    "London, UK",
    website:     "",
    twitter:     "",
    linkedin:    "",
    bio:         "Building the future of product intelligence.",
  });

  const [saved,  setSaved]  = useState<Record<string, boolean>>({});
  const [section, setSection] = useState<"profile" | "security" | "danger">("profile");

  const save = (key: string) => {
    setSaved((s) => ({ ...s, [key]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [key]: false })), 2000);
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="h-full overflow-y-auto bg-background custom-scrollbar">
      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground">Profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your personal information and account settings</p>
        </div>

        {/* ── Section tabs ── */}
        <div className="flex items-center gap-1 mb-6 p-1 rounded-lg bg-muted w-fit">
          {(["profile", "security", "danger"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                section === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              } ${s === "danger" && section !== "danger" ? "hover:text-destructive" : ""}`}
            >
              {s === "danger" ? "Danger zone" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Profile section ── */}
        {section === "profile" && (
          <div className="space-y-6">

            {/* Avatar */}
            <div className="flex items-center gap-5 p-5 rounded-xl border border-border/60 bg-card">
              <div className="relative">
                {user?.photoURL ? (
                  <Image src={user.photoURL} alt="" width={64} height={64} className="rounded-full" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-7 w-7 text-primary" />
                  </div>
                )}
                <button className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-card border border-border/60 text-muted-foreground hover:text-foreground transition-colors">
                  <Camera className="h-3 w-3" />
                </button>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{user?.displayName || "Your name"}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <p className="text-[11px] text-primary mt-1">Google account</p>
              </div>
            </div>

            {/* Basic info */}
            <div className="rounded-xl border border-border/60 bg-card px-5">
              <FieldRow label="Full name" savedKey="displayName" savedStates={saved}>
                <input
                  className={INPUT_CLS}
                  value={form.displayName}
                  onChange={set("displayName")}
                  onBlur={() => save("displayName")}
                  placeholder="Your full name"
                />
              </FieldRow>
              <FieldRow label="Email" hint="Managed by Google sign-in" savedKey="email" savedStates={saved}>
                <input
                  className={`${INPUT_CLS} opacity-60 cursor-not-allowed`}
                  value={form.email}
                  disabled
                  placeholder="your@email.com"
                />
              </FieldRow>
              <FieldRow label="Role" savedKey="role" savedStates={saved}>
                <input
                  className={INPUT_CLS}
                  value={form.role}
                  onChange={set("role")}
                  onBlur={() => save("role")}
                  placeholder="e.g. Senior Product Manager"
                />
              </FieldRow>
              <FieldRow label="Company" savedKey="company" savedStates={saved}>
                <input
                  className={INPUT_CLS}
                  value={form.company}
                  onChange={set("company")}
                  onBlur={() => save("company")}
                  placeholder="e.g. Acme Corp"
                />
              </FieldRow>
              <FieldRow label="Location" savedKey="location" savedStates={saved}>
                <input
                  className={INPUT_CLS}
                  value={form.location}
                  onChange={set("location")}
                  onBlur={() => save("location")}
                  placeholder="e.g. London, UK"
                />
              </FieldRow>
              <FieldRow label="Bio" hint="Brief description about yourself" savedKey="bio" savedStates={saved}>
                <textarea
                  className="w-full px-3 py-2 rounded-lg border border-border/60 bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors resize-none"
                  rows={2}
                  value={form.bio}
                  onChange={set("bio")}
                  onBlur={() => save("bio")}
                  placeholder="Tell your team about yourself…"
                />
              </FieldRow>
            </div>

            {/* Social links */}
            <div className="rounded-xl border border-border/60 bg-card px-5">
              <div className="py-3 border-b border-border/40">
                <p className="text-xs font-semibold text-foreground">Social & web</p>
              </div>
              <FieldRow label="Website" savedKey="website" savedStates={saved}>
                <div className="relative">
                  <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <input className={`${INPUT_CLS} pl-7`} value={form.website} onChange={set("website")} onBlur={() => save("website")} placeholder="https://yoursite.com" />
                </div>
              </FieldRow>
              <FieldRow label="Twitter / X" savedKey="twitter" savedStates={saved}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">@</span>
                  <input className={`${INPUT_CLS} pl-6`} value={form.twitter} onChange={set("twitter")} onBlur={() => save("twitter")} placeholder="username" />
                </div>
              </FieldRow>
              <FieldRow label="LinkedIn" savedKey="linkedin" savedStates={saved}>
                <div className="relative">
                  <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <input className={`${INPUT_CLS} pl-7`} value={form.linkedin} onChange={set("linkedin")} onBlur={() => save("linkedin")} placeholder="https://linkedin.com/in/you" />
                </div>
              </FieldRow>
            </div>

          </div>
        )}

        {/* ── Security section ── */}
        {section === "security" && (
          <div className="space-y-4">

            {/* Connected accounts */}
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <h2 className="text-xs font-semibold text-foreground mb-4">Connected accounts</h2>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#4285F4]/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-[#4285F4]">G</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">Google</p>
                  <p className="text-[10px] text-muted-foreground">{user?.email}</p>
                </div>
                <span className="text-[10px] text-green-600 font-medium px-1.5 py-0.5 rounded-full bg-green-500/10">Primary</span>
              </div>
            </div>

            {/* Active sessions */}
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <h2 className="text-xs font-semibold text-foreground mb-4">Active sessions</h2>
              <div className="space-y-3">
                {SESSIONS.map((sess, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted shrink-0">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{sess.device}</p>
                      <p className="text-[10px] text-muted-foreground">{sess.location} · {sess.ip}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                        <Clock className="h-2.5 w-2.5" /> {sess.time}
                      </p>
                      {sess.current ? (
                        <span className="text-[9px] text-green-600">Current</span>
                      ) : (
                        <button className="text-[9px] text-destructive hover:underline">Revoke</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sign out */}
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out of all devices
            </button>
          </div>
        )}

        {/* ── Danger zone ── */}
        {section === "danger" && (
          <div className="space-y-4">
            <div className="p-5 rounded-xl border border-destructive/30 bg-destructive/5">
              <h2 className="text-sm font-semibold text-destructive mb-1">Delete account</h2>
              <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
                Permanently delete your account and all associated data. This action cannot be undone
                and all your analyses, signals, decisions, and specs will be permanently lost.
              </p>
              <button
                onClick={() => window.confirm("Are you sure? This cannot be undone.") && logout()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete my account
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
