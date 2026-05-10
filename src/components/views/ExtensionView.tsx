"use client";

import React, { useState } from "react";
import {
  Puzzle, Download, Copy, Check, RefreshCw, ExternalLink,
  Shield, Zap, Globe, CheckCircle2, AlertCircle, Clock,
  BarChart3, Brain, ChevronRight
} from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";

const DASHBOARD_URL = "https://speckula.eddgeportal.com";

const STEPS = [
  { n: 1, title: "Install extension",   sub: "Add from Chrome Web Store",         done: false },
  { n: 2, title: "Copy your token",     sub: "Use the token below to authenticate", done: false },
  { n: 3, title: "Paste in extension",  sub: "Open extension → Settings → Token",  done: false },
  { n: 4, title: "Start analysing",     sub: "Browse any page and click Analyse",   done: false },
];

const RECENT_PAGES = [
  { url: "figma.com/pricing",            type: "Pricing page",   insights: 3, time: "10m ago"  },
  { url: "producthunt.com/posts/notion", type: "Product Hunt",   insights: 5, time: "2h ago"   },
  { url: "notion.so",                    type: "Landing page",   insights: 2, time: "1d ago"   },
];

const STATS = [
  { label: "Pages analysed",  value: "47",  icon: Globe   },
  { label: "Insights saved",  value: "12",  icon: Brain   },
  { label: "This week",       value: "8",   icon: BarChart3 },
];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
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
  const [connected] = useState(false);
  const [steps, setSteps] = useState(STEPS);

  const mockToken = user?.uid
    ? `spk_ext_${user.uid.slice(0, 8)}_${"x".repeat(24)}`
    : "spk_ext_sign_in_to_generate";

  const markStep = (n: number) =>
    setSteps((prev) => prev.map((s) => s.n === n ? { ...s, done: !s.done } : s));

  const completedCount = steps.filter((s) => s.done).length;

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
            { icon: Zap,    title: "One-click capture",  desc: "Analyse any page with a single click while browsing"         },
            { icon: Brain,  title: "AI classification",  desc: "Automatically detects pricing, landing, and product pages"    },
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
            <span className="text-xs text-muted-foreground">{completedCount}/{steps.length} done</span>
          </div>
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
            {steps.map((step) => (
              <div
                key={step.n}
                className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors ${step.done ? "opacity-60" : ""}`}
                onClick={() => markStep(step.n)}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                  step.done
                    ? "border-green-500 bg-green-500"
                    : "border-border/60 bg-transparent"
                }`}>
                  {step.done
                    ? <Check className="h-3 w-3 text-white" />
                    : <span className="text-[10px] font-bold text-muted-foreground">{step.n}</span>
                  }
                </div>
                <div className="flex-1">
                  <p className={`text-xs font-medium ${step.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {step.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{step.sub}</p>
                </div>
                {step.n === 1 && (
                  <a
                    href={`${DASHBOARD_URL}/extension`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    Install <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {step.n !== 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />}
              </div>
            ))}
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
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 font-mono text-xs border border-border/40">
              <span className="flex-1 truncate text-foreground select-all">{mockToken}</span>
              <CopyButton value={mockToken} />
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-destructive transition-colors">
                <RefreshCw className="h-3 w-3" /> Regenerate token
              </button>
              <span className="text-muted-foreground/40">·</span>
              <p className="text-[11px] text-muted-foreground">Regenerating invalidates the previous token</p>
            </div>
          </div>
        </div>

        {/* ── Stats or connect prompt ── */}
        {connected ? (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Extension activity</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {STATS.map((s) => (
                <div key={s.label} className="p-4 rounded-xl border border-border/60 bg-card text-center">
                  <s.icon className="h-4 w-4 text-muted-foreground mx-auto mb-2" />
                  <div className="text-xl font-bold text-foreground">{s.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/40">
                <p className="text-xs font-semibold text-foreground">Recent pages</p>
              </div>
              {RECENT_PAGES.map((page, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-foreground truncate">{page.url}</p>
                    <p className="text-[10px] text-muted-foreground">{page.type}</p>
                  </div>
                  <span className="text-[10px] text-primary">{page.insights} insights</span>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                    <Clock className="h-2.5 w-2.5" />
                    {page.time}
                  </div>
                </div>
              ))}
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
              href={`${DASHBOARD_URL}/extension`}
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
