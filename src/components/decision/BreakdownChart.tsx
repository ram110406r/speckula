import React from "react";

interface BreakdownChartProps {
  impact: number;
  effort: number;
  confidence: number;
  demand: number;
}

const rows = [
  ["Impact", "bg-primary"],
  ["Effort", "bg-muted-foreground/50"],
  ["Confidence", "bg-primary/70"],
  ["Demand", "bg-primary/40"],
] as const;

export function BreakdownChart({ impact, effort, confidence, demand }: BreakdownChartProps) {
  const values = [impact, effort, confidence, demand];

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <p className="label-system text-[10px] uppercase tracking-widest text-muted-foreground">Breakdown</p>
      <div className="mt-4 space-y-3">
        {rows.map(([label, color], index) => (
          <div key={label} className="grid grid-cols-[84px_1fr_34px] items-center gap-3">
            <span className="text-sm text-foreground">{label}</span>
            <div className="h-2 overflow-hidden rounded-full bg-border/30">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${values[index] * 10}%` }} />
            </div>
            <span className="label-system text-[11px] text-muted-foreground">{values[index]}/10</span>
          </div>
        ))}
      </div>
    </div>
  );
}
