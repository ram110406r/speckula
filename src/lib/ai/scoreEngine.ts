export interface OpportunityScoreBreakdown {
  impact: number;
  effort: number;
  confidence: number;
  demand: number;
}

export interface OpportunityScoreData extends OpportunityScoreBreakdown {
  reasoning: string;
}

export function calculateScore(data: OpportunityScoreBreakdown) {
  const { impact, effort, confidence, demand } = data;

  if (effort <= 0) return 0;

  const rawScore = (impact * demand * confidence) / effort;
  return Math.min(100, Math.round(rawScore * 10));
}

export function clampScoreValue(value: number) {
  return Math.max(0, Math.min(10, Math.round(value)));
}
