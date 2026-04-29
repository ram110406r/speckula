import React from "react";
import type { ExpectedOutcomeRecord } from "@/lib/ai/expectedOutcome";
import type { ActualOutcomeRecord } from "@/lib/ai/actualOutcome";
import type { OutcomeComparison } from "@/lib/ai/comparisonEngine";

interface OutcomeCardProps {
  expected: ExpectedOutcomeRecord | null;
  actual: ActualOutcomeRecord | null;
  comparison: OutcomeComparison | null;
}

export function OutcomeCard({ expected, actual, comparison }: OutcomeCardProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <p className="label-system text-[10px] uppercase tracking-widest text-muted-foreground">Outcome Loop</p>
      {!expected ? (
        <p className="mt-3 text-sm text-muted-foreground">No expected outcome captured yet.</p>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Expected</p>
            <p className="font-medium text-foreground">{expected.expected.metric}</p>
            <p className="text-muted-foreground">Target {expected.expected.target_value} by {expected.expected.timeframe}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Actual</p>
            <p className="font-medium text-foreground">{actual ? actual.actual.metric : "Not recorded"}</p>
            <p className="text-muted-foreground">{actual ? `Value ${actual.actual.value}` : "Waiting for manual input or analytics ingest"}</p>
          </div>
          {comparison && (
            <div className={`rounded-lg px-3 py-2 text-[12px] ${comparison.success ? "bg-primary/5 text-primary" : "bg-muted/20 text-muted-foreground"}`}>
              {comparison.success ? "Success" : "Missed target"} · Deviation {comparison.deviation >= 0 ? "+" : ""}{comparison.deviation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
