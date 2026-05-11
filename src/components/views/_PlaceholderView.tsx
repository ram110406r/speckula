"use client";

import React from "react";

interface PlaceholderViewProps {
  icon: React.ElementType;
  title: string;
  description: string;
  section: string;
}

export function PlaceholderView({ icon: Icon, title, description, section }: PlaceholderViewProps) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center max-w-sm space-y-5">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 mx-auto">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">{section}</p>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-muted border border-border/50 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[11px] text-muted-foreground font-medium">In development</span>
        </div>
      </div>
    </div>
  );
}
