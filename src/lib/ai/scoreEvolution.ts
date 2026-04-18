import type { OpportunityScoreBreakdown } from "./scoreEngine";

export interface OpportunityScoreState extends OpportunityScoreBreakdown {
  score: number;
}

export interface OpportunityScoreChanges {
  impact?: number;
  effort?: number;
  confidence?: number;
  demand?: number;
}

export function updateScore(existing: OpportunityScoreState, changes: OpportunityScoreChanges) {
  const next: OpportunityScoreState = {
    ...existing,
    ...changes,
    impact: changes.impact ?? existing.impact,
    effort: changes.effort ?? existing.effort,
    confidence: changes.confidence ?? existing.confidence,
    demand: changes.demand ?? existing.demand,
    score: existing.score,
  };

  if (changes.confidence !== undefined) {
    next.confidence = Math.min(10, Math.max(0, changes.confidence));
  }

  if (changes.demand !== undefined) {
    next.demand = Math.min(10, Math.max(0, changes.demand));
  }

  if (changes.effort !== undefined) {
    next.effort = Math.min(10, Math.max(0, changes.effort));
  }

  if (changes.impact !== undefined) {
    next.impact = Math.min(10, Math.max(0, changes.impact));
  }

  return next;
}
