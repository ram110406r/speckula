import type { ActualOutcome } from "./actualOutcome";
import type { ExpectedOutcome } from "./expectedOutcome";

export interface OutcomeComparison {
  deviation: number;
  success: boolean;
}

export function compareOutcomes(expected: ExpectedOutcome, actual: ActualOutcome): OutcomeComparison {
  const deviation = actual.value - expected.target_value;
  const success = actual.value >= expected.target_value;

  return {
    deviation,
    success,
  };
}
