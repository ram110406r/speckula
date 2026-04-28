import { calculateScore, clampScoreValue, type OpportunityScoreBreakdown } from "./scoreEngine";

export interface OpportunityScoreState extends OpportunityScoreBreakdown {
  score: number;
}

export interface OpportunityScoreChanges {
  impact?: number;
  effort?: number;
  confidence?: number;
  demand?: number;
}

// Apply per-dimension changes and recompute the composite score in one
// step. Previously the function ignored its own input — `score: existing.score`
// kept the old composite even after changing the underlying dimensions —
// so callers had to remember to call calculateScore themselves. Now the
// score is always derived, never stale.
export function updateScore(existing: OpportunityScoreState, changes: OpportunityScoreChanges) {
  const breakdown: OpportunityScoreBreakdown = {
    impact: clampScoreValue(changes.impact ?? existing.impact),
    effort: clampScoreValue(changes.effort ?? existing.effort),
    confidence: clampScoreValue(changes.confidence ?? existing.confidence),
    demand: clampScoreValue(changes.demand ?? existing.demand),
  };
  return {
    ...breakdown,
    score: calculateScore(breakdown),
  } satisfies OpportunityScoreState;
}
