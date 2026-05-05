// Canonical outcome types. Both expected (set up-front) and actual (measured
// post-launch) share the same `metric` and `unit` fields so the Comparison
// Engine can verify a like-for-like comparison instead of subtracting numbers
// blindly.

export interface ExpectedOutcome {
  metric: string;
  // Numeric target. Older code sometimes stored this as a string; consumers
  // should `Number()` defensively if reading legacy data.
  target_value: number;
  // v2.2: current value at prediction time. Optional for backward compat with
  // outcomes recorded before baseline tracking. Used by computePredictionQuality
  // to penalize low-ambition predictions ("hit 12% but should have aimed for 40%").
  baseline?: number | null;
  // Human-friendly unit ("DAU", "% retention", "$/mo"). Compared
  // case-insensitively in the Comparison Engine.
  unit?: string;
  // Free-form, e.g. "30 days" or ISO timestamp. Comparison engine just
  // verifies the actual was observed within the timeframe when present.
  timeframe: string;
}

export interface ActualOutcome {
  metric: string;
  value: number;
  unit?: string;
  observedAt: string;
}

export interface OutcomeFeedback {
  decisionId: string;
  success: boolean;
  expected: ExpectedOutcome;
  actual: ActualOutcome;
}
