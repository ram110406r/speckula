import type { ActualOutcome, ExpectedOutcome } from "./outcomeTypes";

export interface OutcomeComparison {
  // Absolute deviation (actual - target). Positive when overshooting.
  deviation: number;
  // Relative deviation as a fraction of the target. NaN when target is 0.
  relativeDeviation: number;
  success: boolean;
  // Set when expected.metric / expected.unit don't match actual's. The
  // comparison still returns numbers but the caller should treat success
  // as advisory only.
  metricMismatch?: { reason: "metric" | "unit" };
}

const normalize = (s: string | undefined): string =>
  (s ?? "").toLowerCase().replace(/[\s_-]+/g, " ").trim();

export function compareOutcomes(
  expected: ExpectedOutcome,
  actual: ActualOutcome
): OutcomeComparison {
  const expectedTarget = Number(expected.target_value);
  const actualValue = Number(actual.value);

  if (!Number.isFinite(expectedTarget) || !Number.isFinite(actualValue)) {
    return {
      deviation: NaN,
      relativeDeviation: NaN,
      success: false,
      metricMismatch: { reason: "metric" },
    };
  }

  // Verify like-for-like comparison. If the metric names diverge, mark
  // mismatch — the caller can still display numbers but should warn.
  const metricMismatch =
    normalize(expected.metric) && normalize(actual.metric) &&
    normalize(expected.metric) !== normalize(actual.metric)
      ? ({ reason: "metric" as const })
      : (expected.unit && actual.unit && normalize(expected.unit) !== normalize(actual.unit))
        ? ({ reason: "unit" as const })
        : undefined;

  const deviation = actualValue - expectedTarget;
  const relativeDeviation = expectedTarget !== 0 ? deviation / Math.abs(expectedTarget) : NaN;
  const success = actualValue >= expectedTarget;

  return {
    deviation,
    relativeDeviation,
    success,
    ...(metricMismatch ? { metricMismatch } : {}),
  };
}
