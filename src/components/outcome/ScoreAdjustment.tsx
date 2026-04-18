import React from "react";

interface ScoreAdjustmentProps {
  oldConfidence: number;
  newConfidence: number;
}

export function ScoreAdjustment({ oldConfidence, newConfidence }: ScoreAdjustmentProps) {
  const delta = newConfidence - oldConfidence;

  return (
    <div className="rounded-2xl border border-border/60 bg-white p-5 shadow-sm">
      <p className="label-system text-[10px] uppercase tracking-widest text-muted-foreground">Score Adjustment</p>
      <p className="mt-3 text-sm text-foreground">
        Confidence {oldConfidence}/10 → {newConfidence}/10
      </p>
      <p className={`mt-2 text-sm ${delta >= 0 ? "text-primary" : "text-muted-foreground"}`}>
        {delta >= 0 ? `+${delta}` : delta} after outcome review
      </p>
    </div>
  );
}
