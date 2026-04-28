export interface OpportunityScoreBreakdown {
  impact: number;
  effort: number;
  confidence: number;
  demand: number;
}

export interface OpportunityScoreData extends OpportunityScoreBreakdown {
  reasoning: string;
}

// Each input is calibrated 1-10, with most real decisions landing 4-7 on
// each dimension per the prompt anchors. The previous formula
// (I*D*C / E * 10) was bottom-loaded and ceiling-clipped: anything above
// the mid-range immediately maxed out at 100, while merely-good ideas
// scored very low.
//
// New formula: average the three "upside" dimensions (impact, demand,
// confidence), apply a smooth effort penalty (effort=1 → no penalty,
// effort=10 → 50% penalty), scale to 0-100. Calibrated so:
//   (1,1,1,1)    →  5      — token "this exists"
//   (5,5,5,5)    →  ~39    — mid (in the 30-70 band the prompt expects)
//   (10,10,10,1) → 100    — strong & cheap
//   (10,10,10,10) → 50    — strong & expensive (still the right ballpark)
//   (1,1,1,10)   →  5     — weak & expensive
export function calculateScore(data: OpportunityScoreBreakdown) {
  const impact = clampScoreValue(data.impact);
  const demand = clampScoreValue(data.demand);
  const confidence = clampScoreValue(data.confidence);
  const effort = clampScoreValue(data.effort);

  if (effort <= 0) return 0;

  const upsideAvg = (impact + demand + confidence) / 3; // 1..10
  // Effort penalty: linear from 1.0 (effort=1) to 0.5 (effort=10).
  const effortPenalty = 1 - ((effort - 1) / 9) * 0.5;
  const normalized = upsideAvg * effortPenalty * 10; // ~5..100
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

// Clamp to 1-10 (inclusive). The prompts ask the model for integers in
// the 1-10 range with explicit anchors; treating 0 as legal here was
// causing it to silently bleed into downstream "missing data" filters.
export function clampScoreValue(value: number) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(10, n));
}
