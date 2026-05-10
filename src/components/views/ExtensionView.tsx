"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Puzzle, Download, Copy, Check, RefreshCw, ExternalLink,
  Shield, Zap, Globe, CheckCircle2, AlertCircle,
  BarChart3, Brain, ChevronRight, Loader2
} from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  getUsageStats,
  subscribeToExtensionPreferences,
  getExtensionSetupSteps,
  updateExtensionSetupStep,
  type ExtensionSetupSteps,
} from "@/lib/firebase/db";

// Update this when the extension is published to the Chrome Web Store
const CHROME_STORE_URL = "https://chrome.google.com/webstore/search/speckula";

const STEP_KEYS: Array<keyof Omit<ExtensionSetupSteps, "updatedAt">> = [
  "installed",
  "tokenCopied",
  "tokenPasted",
  "firstCapture",
];

const STEP_META = [
  { title: "Install extension",  sub: "Add from Chrome Web Store",          key: "installed"    },
  { title: "Copy your token",    sub: "Use the token below to authenticate", key: "tokenCopied"  },
  { title: "Paste in extension", sub: "Open extension → Settings → Token",  key: "tokenPasted"  },
  { title: "Start analysing",    sub: "Browse any page and click Analyse",   key: "firstCapture" },
] as const;

function CopyButton({ value, onCopied }: { value: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    onCopied?.();
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function ExtensionView() {
  const { user } = useAuth();
  const [idToken,        setIdToken]        = useState<string | null>(null);
  const [tokenLoading,   setTokenLoading]   = useState(true);
  const [stepsDone,      setStepsDone]      = useState<Record<string, boolean>>({});
  const [stepsLoading,   setStepsLoading]   = useState(true);
  const [signalCount,    setSignalCount]    = useState(0);
  const [extCount,       setExtCount]       = useState(0);
  const [weekCount,      setWeekCount]      = useState(0);
  const [statsLoading,   setStatsLoading]   = useState(true);
  const [connected,      setConnected]      = useState(false);

  // Load the real Firebase ID token
  useEffect(() => {
    if (!user) { setTokenLoading(false); return; }
    user.getIdToken().then((t) => { setIdToken(t); setTokenLoading(false); }).catch(() => setTokenLoading(false));
  }, [user]);

  // Refresh token every 50 minutes (Firebase tokens expire after 60 min)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      user.getIdToken(true).then(setIdToken).catch(() => {});
    }, 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // Load setup steps from Firestore
  useEffect(() => {
    if (!user) { setStepsLoading(false); return; }
    getExtensionSetupSteps(user.uid).then((s) => {
      setStepsDone({
        installed:    s.installed,
        tokenCopied:  s.tokenCopied,
        tokenPasted:  s.tokenPasted,
        firstCapture: s.firstCapture,
      });
      setStepsLoading(false);
    }).catch(() => setStepsLoading(false));
  }, [user]);

  // Load usage stats from Firestore
  useEffect(() => {
    if (!user) { setStatsLoading(false); return; }
    getUsageStats(user.uid).then((stats) => {
      setSignalCount(stats.signals);
      setExtCount(stats.signalsViaExtension);
      setWeekCount(stats.signalsThisWeek);
      setStatsLoading(false);
    }).catch(() => setStatsLoading(false));
  }, [user]);

  // Auto-complete step 4 once signals exist
  useEffect(() => {
    if (!user || signalCount === 0 || stepsDone.firstCapture) return;
    const next = { ...stepsDone, firstCapture: true };
    setStepsDone(next);
    updateExtensionSetupStep(user.uid, "firstCapture", true);
  }, [signalCount, stepsDone, user]);

  // Check extension preferences to derive connection state
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToExtensionPreferences(user.uid, (prefs) => {
      setConnected(!!prefs.activeWorkspaceId);
    });
    return unsub;
  }, [user]);

  const toggleStep = useCallback((key: string) => {
    if (!user) return;
    const next = !stepsDone[key];
    setStepsDone((prev) => ({ ...prev, [key]: next }));
    updateExtensionSetupStep(user.uid, key as keyof Omit<ExtensionSetupSteps, "updatedAt">, next);
  }, [user, stepsDone]);

  const completedCount = STEP_KEYS.filter((k) => stepsDone[k]).length;

  const maskedToken = idToken
    ? `${"•".repeat(32)}${idToken.slice(-8)}`
    : tokenLoading ? "Loading…" : "Sign in to generate your token";

  return (
    <div className="h-full overflow-y-auto bg-background custom-scrollbar">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Puzzle className="h-5 w-5 text-primary" />
              Chrome Extension
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Capture competitive intelligence while browsing — automatically
            </p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            connected
              ? "bg-green-500/10 text-green-600 border border-green-500/20"
              : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
          }`}>
            {connected ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            {connected ? "Connected" : "Not connected"}
          </div>
        </div>

        {/* ── Feature highlights ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Zap,    title: "One-click capture",  desc: "Analyse any page with a single click while browsing"               },
            { icon: Brain,  title: "AI classification",  desc: "Automatically detects pricing, landing, and product pages"          },
            { icon: Shield, title: "Secure sync",        desc: "Your token is stored locally — data goes directly to your workspace" },
          ].map((f) => (
            <div key={f.title} className="p-4 rounded-xl border border-border/60 bg-card">
              <div className="p-2 rounded-lg bg-primary/10 w-fit mb-3">
                <f.icon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs font-semibold text-foreground">{f.title}</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Setup checklist ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Setup guide</h2>
            <span className="text-xs text-muted-foreground">{completedCount}/{STEP_META.length} done</span>
          </div>
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
            {stepsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : STEP_META.map((step, i) => {
              const done = !!stepsDone[step.key];
              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors ${done ? "opacity-60" : ""}`}
                  onClick={() => toggleStep(step.key)}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                    done ? "border-green-500 bg-green-500" : "border-border/60 bg-transparent"
                  }`}>
                    {done
                      ? <Check className="h-3 w-3 text-white" />
                      : <span className="text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                    }
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs font-medium ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {step.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{step.sub}</p>
                  </div>
                  {step.key === "installed" && (
                    <a
                      href={CHROME_STORE_URL}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      Install <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {step.key !== "installed" && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Auth token ── */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Your extension token</h2>
          <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Paste this token in the extension settings to link it to your workspace.
              Keep it private — it grants access to your account.
            </p>
            {tokenLoading ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/40">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Generating token…</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 font-mono text-xs border border-border/40">
                <span className="flex-1 truncate text-foreground select-all">{maskedToken}</span>
                {idToken && (
                  <CopyButton
                    value={idToken}
                    onCopied={() => {
                      if (!stepsDone.tokenCopied) toggleStep("tokenCopied");
                    }}
                  />
                )}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (!user) return;
                  setTokenLoading(true);
                  user.getIdToken(true).then((t) => { setIdToken(t); setTokenLoading(false); }).catch(() => setTokenLoading(false));
                }}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-3 w-3" /> Refresh token
              </button>
              <span className="text-muted-foreground/40">·</span>
              <p className="text-[11px] text-muted-foreground">Token expires every 60 minutes</p>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        {connected ? (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Extension activity</h2>
            <div className="grid grid-cols-3 gap-3">
              {statsLoading ? (
                <div className="col-span-3 flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                [
                  { label: "Total signals",  value: signalCount, icon: Globe     },
                  { label: "Via extension",  value: extCount,    icon: Brain     },
                  { label: "This week",      value: weekCount,   icon: BarChart3 },
                ].map((s) => (
                  <div key={s.label} className="p-4 rounded-xl border border-border/60 bg-card text-center">
                    <s.icon className="h-4 w-4 text-muted-foreground mx-auto mb-2" />
                    <div className="text-xl font-bold text-foreground">{s.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center py-8 gap-4 rounded-xl border border-dashed border-border/60 bg-card">
            <div className="p-4 rounded-full bg-primary/10">
              <Puzzle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Extension not yet connected</p>
              <p className="text-xs text-muted-foreground mt-1">Follow the setup guide above to start capturing intelligence</p>
            </div>
            <a
              href={CHROME_STORE_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <Download className="h-3.5 w-3.5" /> Install extension
            </a>
          </div>
        )}

      </div>
    </div>
  );
}
