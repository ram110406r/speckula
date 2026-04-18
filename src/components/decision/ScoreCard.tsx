import React from "react";

interface ScoreCardProps {
  score: number;
  impact: number;
  effort: number;
  confidence: number;
  demand: number;
  reasoning: string;
}

export function ScoreCard({ score, impact, effort, confidence, demand, reasoning }: ScoreCardProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white p-5 shadow-sm">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="label-system text-[10px] uppercase tracking-widest text-muted-foreground">Opportunity Score</p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{score}</h3>
        </div>
        <div className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary">
          Decision Intelligence
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          ["Impact", impact],
          ["Effort", effort],
          ["Confidence", confidence],
          ["Demand", demand],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
            <p className="label-system text-[10px] text-muted-foreground">{label as string}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{value as number}/10</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {reasoning}
      </p>
    </div>
  );
}
