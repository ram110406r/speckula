"use client";

import React from "react";
import { AlertTriangle, Zap, GitBranch, User, Bookmark, ArrowUpRight } from "lucide-react";
import type { Insight } from "@/lib/firebase/db";

const NODE_CONFIG = {
  "pain-point": {
    label: "Pain Point",
    Icon: AlertTriangle,
    color: "var(--signal-pain-point)",
    bgColor: "var(--signal-pain-point-bg)",
  },
  "opportunity": {
    label: "Opportunity",
    Icon: Zap,
    color: "var(--signal-opportunity)",
    bgColor: "var(--signal-opportunity-bg)",
  },
  "pattern": {
    label: "Pattern",
    Icon: GitBranch,
    color: "var(--signal-pattern)",
    bgColor: "var(--signal-pattern-bg)",
  },
  "user-segment": {
    label: "User Segment",
    Icon: User,
    color: "var(--signal-user-segment)",
    bgColor: "var(--signal-user-segment-bg)",
  },
} as const;

interface NodeCardProps {
  insight: Insight;
  animationDelay?: number;
}

export function NodeCard({ insight, animationDelay = 0 }: NodeCardProps) {
  const cfg = NODE_CONFIG[insight.category] ?? NODE_CONFIG["opportunity"];
  const { Icon } = cfg;

  return (
    <article
      role="article"
      aria-label={`${cfg.label}: ${insight.title}`}
      className="node-card-animate relative flex flex-col bg-[var(--signal-bg)] dark:bg-[var(--signal-surface)] rounded-lg border border-[var(--signal-border)] overflow-hidden transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-[var(--signal-accent)] hover:shadow-[0_8px_16px_rgba(212,115,61,0.12)]"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Semantic top-border strip */}
      <div className="h-[3px] w-full shrink-0" style={{ backgroundColor: cfg.color }} />

      <div className="flex flex-col gap-4 p-6 flex-1">
        {/* Type badge */}
        <div>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] font-mono text-[11px] font-medium tracking-[0.04em] uppercase"
            style={{ backgroundColor: cfg.bgColor, color: cfg.color }}
          >
            <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} />
            {cfg.label}
          </span>
        </div>

        {/* Title – display font */}
        <h2
          className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-[var(--signal-text-primary)]"
          style={{ fontFamily: "var(--font-display, Georgia, 'Times New Roman', serif)" }}
        >
          {insight.title}
        </h2>

        {/* Body */}
        <p className="text-[14px] leading-[1.65] text-[var(--signal-text-secondary)] flex-1">
          {insight.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#EFE8DD] dark:border-[var(--signal-border)] mt-auto">
          <span className="font-mono text-[11px] text-[var(--signal-text-tertiary)] truncate max-w-[140px]">
            From Research Document
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              aria-label="Save signal"
              className="w-7 h-7 flex items-center justify-center rounded-full border border-[var(--signal-border)] text-[var(--signal-text-tertiary)] transition-all hover:border-[var(--signal-accent)] hover:text-[var(--signal-accent)] hover:bg-[var(--signal-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal-accent)]/40"
            >
              <Bookmark className="h-3 w-3" />
            </button>
            <button
              aria-label="Expand signal"
              className="w-7 h-7 flex items-center justify-center rounded-full border border-[var(--signal-border)] text-[var(--signal-text-tertiary)] transition-all hover:border-[var(--signal-accent)] hover:text-[var(--signal-accent)] hover:bg-[var(--signal-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal-accent)]/40"
            >
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
