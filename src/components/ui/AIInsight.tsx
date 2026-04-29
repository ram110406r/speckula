"use client";

import React from "react";
import { Sparkles } from "lucide-react";

export interface AIInsightAction {
  label: string;
  onClick: () => void;
}

export interface AIInsightProps {
  message: string;
  actions?: AIInsightAction[];
  severity?: "info" | "warning" | "danger";
  className?: string;
}

const SEVERITY_STYLES = {
  info: {
    wrapper: "border-l-primary/50 bg-primary/[0.04]",
    icon: "text-primary",
    text: "text-foreground/90",
    action: "text-primary hover:text-primary/70",
  },
  warning: {
    wrapper: "border-l-warning bg-warning/5",
    icon: "text-warning",
    text: "text-foreground",
    action: "text-warning hover:underline",
  },
  danger: {
    wrapper: "border-l-destructive bg-destructive/5",
    icon: "text-destructive",
    text: "text-foreground",
    action: "text-destructive hover:underline",
  },
} as const;

export function AIInsight({
  message,
  actions = [],
  severity = "info",
  className = "",
}: AIInsightProps) {
  const s = SEVERITY_STYLES[severity];

  return (
    <div
      className={`flex gap-2.5 rounded-r-md border-l-2 px-3 py-2.5 ${s.wrapper} ${className}`}
    >
      <Sparkles className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${s.icon}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={`text-xs leading-relaxed ${s.text}`}>{message}</p>
        {actions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-3">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className={`text-[11px] font-medium underline-offset-2 transition-colors ${s.action}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
