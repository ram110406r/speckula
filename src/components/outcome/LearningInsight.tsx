import React from "react";

interface LearningInsightProps {
  insight: string | null;
}

export function LearningInsight({ insight }: LearningInsightProps) {
  if (!insight) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <p className="label-system text-[10px] uppercase tracking-widest text-muted-foreground">Learning Insight</p>
      <p className="mt-3 text-sm leading-relaxed text-foreground">{insight}</p>
    </div>
  );
}
