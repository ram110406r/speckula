import type { OpportunityScoreState } from "./scoreEvolution";

export function updateConfidenceScore(scoreData: OpportunityScoreState, success: boolean) {
  const nextConfidence = success
    ? Math.min(10, scoreData.confidence + 1)
    : Math.max(0, scoreData.confidence - 1);

  return {
    ...scoreData,
    confidence: nextConfidence,
  };
}
