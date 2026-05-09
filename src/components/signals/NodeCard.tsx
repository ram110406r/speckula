"use client";

import React, { useState, useRef } from "react";
import { AlertTriangle, Zap, GitBranch, User, Trash2, Pencil, Check, X, ArrowRight } from "lucide-react";
import type { Insight } from "@/lib/firebase/db";

const NODE_CONFIG = {
  "pain-point":   { label: "Pain Point",   Icon: AlertTriangle, color: "var(--signal-pain-point)",    bgColor: "var(--signal-pain-point-bg)"    },
  "opportunity":  { label: "Opportunity",  Icon: Zap,           color: "var(--signal-opportunity)",   bgColor: "var(--signal-opportunity-bg)"   },
  "pattern":      { label: "Pattern",      Icon: GitBranch,     color: "var(--signal-pattern)",       bgColor: "var(--signal-pattern-bg)"       },
  "user-segment": { label: "User Segment", Icon: User,          color: "var(--signal-user-segment)",  bgColor: "var(--signal-user-segment-bg)"  },
} as const;

interface NodeCardProps {
  insight: Insight;
  animationDelay?: number;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, title: string, description: string) => void;
  onConvertToDecision?: (insight: Insight) => void;
}

export function NodeCard({ insight, animationDelay = 0, onDelete, onUpdate, onConvertToDecision }: NodeCardProps) {
  const cfg = NODE_CONFIG[insight.category] ?? NODE_CONFIG["opportunity"];
  const { Icon } = cfg;

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(insight.title);
  const [editDesc, setEditDesc] = useState(insight.description ?? "");
  const titleRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(insight.title);
    setEditDesc(insight.description ?? "");
    setEditing(true);
    setTimeout(() => titleRef.current?.focus(), 30);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditTitle(insight.title);
    setEditDesc(insight.description ?? "");
  };

  const commitEdit = () => {
    const t = editTitle.trim();
    const d = editDesc.trim();
    if (!t) { cancelEdit(); return; }
    setEditing(false);
    onUpdate?.(insight.id!, t, d);
  };

  return (
    <article
      role="article"
      aria-label={`${cfg.label}: ${insight.title}`}
      className="node-card-animate relative flex flex-col bg-card rounded-lg border border-border overflow-hidden transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_16px_rgba(37,99,235,0.08)] group/card"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="h-[3px] w-full shrink-0" style={{ backgroundColor: cfg.color }} />

      <div className="flex flex-col gap-4 p-4 sm:p-6 flex-1">
        {/* Type badge + actions */}
        <div className="flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] font-mono text-[11px] font-medium tracking-[0.04em] uppercase"
            style={{ backgroundColor: cfg.bgColor, color: cfg.color }}
          >
            <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} />
            {cfg.label}
          </span>
          <div className="flex items-center gap-1 md:opacity-0 md:group-hover/card:opacity-100 transition-opacity">
            {!editing && (
              <button
                onClick={startEdit}
                title="Edit"
                aria-label="Edit signal"
                className="h-8 w-8 sm:h-6 sm:w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Pencil className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
              </button>
            )}
            {onDelete && !editing && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(insight.id!); }}
                title="Delete"
                aria-label="Delete signal"
                className="h-8 w-8 sm:h-6 sm:w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="flex flex-col gap-2">
            <input
              ref={titleRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
              className="w-full text-[15px] font-semibold bg-muted/40 border border-border/60 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
              placeholder="Signal title"
            />
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              className="w-full text-[13px] bg-muted/40 border border-border/60 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40 text-muted-foreground resize-none"
              placeholder="Description"
            />
            <div className="flex gap-1.5 justify-end">
              <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 sm:px-2.5 sm:py-1 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors">
                <X className="h-3 w-3" /> Cancel
              </button>
              <button onClick={commitEdit} className="flex items-center gap-1 px-3 py-1.5 sm:px-2.5 sm:py-1 rounded-md text-xs bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                <Check className="h-3 w-3" /> Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
              {insight.title}
            </h2>
            <p className="text-[14px] leading-[1.65] text-muted-foreground flex-1">
              {insight.description}
            </p>
          </>
        )}

        {/* Footer */}
        {!editing && (
          <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
            <span className="font-mono text-[11px] text-muted-foreground/60 truncate max-w-[140px]">
              From Research Document
            </span>
            {onConvertToDecision && (
              <button
                onClick={(e) => { e.stopPropagation(); onConvertToDecision(insight); }}
                title="Convert to Decision"
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline underline-offset-2 transition-colors"
              >
                Decision <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
