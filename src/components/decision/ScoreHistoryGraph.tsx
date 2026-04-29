import React from "react";
import type { OpportunityScoreHistoryEntry } from "@/lib/ai/scoreHistory";

interface ScoreHistoryGraphProps {
  history: OpportunityScoreHistoryEntry[];
}

export function ScoreHistoryGraph({ history }: ScoreHistoryGraphProps) {
  const visible = history.slice(-8);
  const max = Math.max(100, ...visible.map((entry) => entry.score));

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <p className="label-system text-[10px] uppercase tracking-widest text-muted-foreground">Score History</p>
      <div className="mt-4 flex items-end gap-2 h-24">
        {visible.length === 0 ? (
          <div className="flex h-full items-center text-sm text-muted-foreground">No score history yet.</div>
        ) : (
          visible.map((entry, index) => (
            <div key={`${entry.timestamp}-${index}`} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t-md bg-muted/20 overflow-hidden flex items-end h-20">
                <div className="w-full bg-primary/80" style={{ height: `${(entry.score / max) * 100}%` }} />
              </div>
              <span className="label-system text-[10px] text-muted-foreground">{entry.score}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
