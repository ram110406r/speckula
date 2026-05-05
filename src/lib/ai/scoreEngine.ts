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

// ── v2.1 Feedback layer (Stage 11) ──────────────────────────────────────────
// Deterministic confidence adjustment driven by the user's track record. No
// LLM calls — past actuals vs. expected get distilled into a single 0–1
// signal in `db.ts:getUserAccuracySignal`, then this function applies it.

function lerp(a: number, b: number, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return a + (b - a) * clamped;
}

export interface AccuracyContext {
  // Rolling accuracy across the user's recent decisions (0–1).
  // 0.5 = neutral / no data.
  userAccuracy?: number | null;
  // Per-pattern accuracy for the same metric / theme (optional v1.1).
  similarPatternAccuracy?: number | null;
  // Average calibration error 0–1 across recent decisions.
  // 0 = confidence perfectly tracks accuracy. ≥0.3 → significant penalty.
  calibrationError?: number | null;
  // v2.6 calibration bias (signed). Computed in db.ts:getUserFeedbackSignals.
  //   > 0 → user is systematically overconfident → multiply confidence ×0.9
  //   < 0 → systematically underconfident → multiply ×1.1
  // Distinct from calibrationError (absolute): bias has direction.
  calibrationBias?: number | null;
  // Same signal scoped to one pattern (metric or theme). Lets us downweight
  // only the categories the user misjudges, not all confidence.
  similarPatternBias?: number | null;
}

// Apply past-outcome accuracy to a base confidence (1–10 scale).
//   userAccuracy=0.5 → no adjustment (1.0× factor)
//   userAccuracy=1.0 → +15% boost  (1.15× factor)
//   userAccuracy=0.0 → −15% penalty (0.85× factor)
// v2.2: also penalize when past confidence didn't track actual outcomes
// (high calibration error → user is overconfident → squeeze further).
// v2.6: layer a binary calibration-bias correction on top — over/under-
// confident users get pulled toward reality before the result is clamped.
export function adjustedConfidence(baseConfidence: number, context: AccuracyContext): number {
  const userT = typeof context.userAccuracy === "number" && Number.isFinite(context.userAccuracy)
    ? context.userAccuracy
    : 0.5;
  const patternT = typeof context.similarPatternAccuracy === "number" && Number.isFinite(context.similarPatternAccuracy)
    ? context.similarPatternAccuracy
    : 0.5;

  const userFactor = lerp(0.85, 1.15, userT);
  const patternFactor = lerp(0.8, 1.2, patternT);

  const calibT = typeof context.calibrationError === "number" && Number.isFinite(context.calibrationError)
    ? context.calibrationError
    : 0;
  const calibrationFactor = lerp(1.0, 0.8, Math.max(0, Math.min(1, calibT)));

  // Bias correction (binary per spec). Pattern bias dominates when present —
  // it's the more specific signal — otherwise fall back to the global bias.
  const biasSignal =
    typeof context.similarPatternBias === "number" && Number.isFinite(context.similarPatternBias)
      ? context.similarPatternBias
      : typeof context.calibrationBias === "number" && Number.isFinite(context.calibrationBias)
      ? context.calibrationBias
      : 0;
  const biasFactor = biasSignal > 0 ? 0.9 : biasSignal < 0 ? 1.1 : 1.0;

  const adjusted = baseConfidence * userFactor * patternFactor * calibrationFactor * biasFactor;
  return clampScoreValue(adjusted);
}

// Compute the 0–1 accuracy signal for a single (target, actual) pair.
// "higher is better" is the default since most product metrics (DAU, retention,
// conversion, activation) are upside metrics. Pass higherIsBetter=false for
// metrics like churn, latency, or error rate.
export function computeAccuracyNorm(
  target: number,
  actual: number,
  higherIsBetter = true
): number {
  if (!Number.isFinite(target) || !Number.isFinite(actual)) return 0.5;
  const denom = Math.max(1, Math.abs(target));
  const delta = (actual - target) / denom;
  const accuracy = higherIsBetter ? 1 + delta : 1 - delta;
  const clamped = Math.max(0, Math.min(2, accuracy));
  return clamped / 2;
}

// v2.2: prediction-quality score. Penalizes low-ambition predictions.
//   target / baseline:
//     1.0 → no improvement asked → 1.0 (neutral)
//     2.0 → asked to double → 2.0 (most ambitious)
//     0.5 → asked to halve → 0.5 (least ambitious / hedged)
// Clamped to [0.5, 2.0]. When baseline is missing or zero, defaults to 1.0
// (we can't measure ambition without a baseline).
export function computePredictionQuality(target: number, baseline: number | null | undefined): number {
  if (!Number.isFinite(target)) return 1.0;
  if (baseline === null || baseline === undefined || !Number.isFinite(baseline) || baseline === 0) {
    return 1.0;
  }
  const ratio = target / baseline;
  return Math.max(0.5, Math.min(2.0, ratio));
}

// v2.2: combine raw accuracy with prediction quality so low-ambition wins
// don't game the feedback loop.
//   finalAccuracy = clamp(accuracyNorm * predictionQuality, 0, 1)
// Behaviors (with neutral = 0.5, perfect = 1.0):
//   accuracyNorm=0.5 (hit target), quality=1.0 (no baseline) → 0.5 (neutral, preserved)
//   accuracyNorm=0.5 (hit target), quality=2.0 (ambitious 2x bet) → 1.0 (max reward)
//   accuracyNorm=0.5 (hit target), quality=0.5 (sandbagged) → 0.25 (penalty)
//   accuracyNorm=1.0 (over-delivered), quality=1.0 → 1.0 (max)
//   accuracyNorm=0.0 (missed badly), quality=anything → 0.0 (max penalty)
export function computeFinalAccuracy(accuracyNorm: number, predictionQuality: number): number {
  if (!Number.isFinite(accuracyNorm) || !Number.isFinite(predictionQuality)) return 0.5;
  return Math.max(0, Math.min(1, accuracyNorm * predictionQuality));
}

// v2.2: how well did the user's stated confidence match the actual outcome?
//   confidence: 1–10  → normalize to 0–1
//   accuracyNorm: 0–1
//   calibrationError = |confidenceNorm − accuracyNorm| ∈ [0, 1]
// 0 = perfectly calibrated. 1 = wildly miscalibrated.
export function computeCalibrationError(confidence: number, accuracyNorm: number): number {
  if (!Number.isFinite(confidence) || !Number.isFinite(accuracyNorm)) return 0.5;
  const confidenceNorm = Math.max(0, Math.min(1, (confidence - 1) / 9));
  const acc = Math.max(0, Math.min(1, accuracyNorm));
  return Math.abs(confidenceNorm - acc);
}

// ── v2.9 stability guards ──────────────────────────────────────────────────
// Outcome validity filter — returns false for data points the optimization
// layer should exclude from aggregations:
//   - timeframe shorter than the minimum (defaults to 7 days)
//   - baseline missing AND target too small to measure reliably
//   - actual recorded before the timeframe elapsed
// Legacy records without an explicit isValid field default to `true` at the
// aggregation layer, so adding this guard never invalidates existing data.

const MIN_TIMEFRAME_DAYS = 7;
const MIN_TARGET_WHEN_NO_BASELINE = 5;

export function parseTimeframeDays(s: string | null | undefined): number | null {
  if (!s || typeof s !== "string") return null;
  const match = s.match(/(\d+(?:\.\d+)?)\s*days?/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export interface OutcomeValidityInput {
  timeframe?: string | null;
  baseline?: number | null;
  target?: number;
  // Optional anchors for the "observed-too-early" check. Both must be present
  // (and finite) for the check to fire.
  decisionStartMs?: number | null;
  observedAtMs?: number | null;
}

export function computeOutcomeValidity(input: OutcomeValidityInput): boolean {
  const days = parseTimeframeDays(input.timeframe ?? null);

  if (days !== null && days < MIN_TIMEFRAME_DAYS) return false;

  const baselineMissing =
    input.baseline === null || input.baseline === undefined || !Number.isFinite(input.baseline as number);
  if (
    baselineMissing &&
    typeof input.target === "number" &&
    Number.isFinite(input.target) &&
    input.target < MIN_TARGET_WHEN_NO_BASELINE
  ) {
    return false;
  }

  if (
    days !== null &&
    typeof input.decisionStartMs === "number" &&
    Number.isFinite(input.decisionStartMs) &&
    typeof input.observedAtMs === "number" &&
    Number.isFinite(input.observedAtMs)
  ) {
    const elapsedDays = (input.observedAtMs - input.decisionStartMs) / (1000 * 60 * 60 * 24);
    if (elapsedDays < days) return false;
  }

  return true;
}
