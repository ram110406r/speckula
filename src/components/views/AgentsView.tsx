"use client";

import { Bot, Sparkles } from "lucide-react";

export function AgentsView() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-background px-6 py-20 text-center">
      <div className="relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-muted/50">
          <Bot className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
          <Sparkles className="h-3 w-3 text-primary-foreground" />
        </span>
      </div>

      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        Coming Soon
      </div>

      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        AI Agents
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Autonomous agents that continuously monitor your market, synthesise signals, and surface decisions — without you having to ask.
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-md">
        {[
          { label: "Intelligence Agent", sub: "Live market monitoring" },
          { label: "Synthesis Agent",   sub: "Cross-source analysis"  },
          { label: "Delivery Agent",    sub: "Automated reporting"    },
        ].map(({ label, sub }) => (
          <div key={label} className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-left">
            <p className="text-xs font-medium text-foreground">{label}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
