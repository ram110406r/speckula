export interface ExpectedOutcome {
  metric: string;
  target_value: number;
  timeframe: string;
}

export interface ExpectedOutcomeRecord {
  ideaId: string;
  expected: ExpectedOutcome;
}

const STORAGE_PREFIX = "buildcase-expected-outcome-v1";

function keyFor(ideaId: string) {
  return `${STORAGE_PREFIX}:${ideaId}`;
}

export function setExpectedOutcome(ideaId: string, metric: string, target: number, timeframe: string) {
  if (typeof window === "undefined") return;

  const data: ExpectedOutcomeRecord = {
    ideaId,
    expected: {
      metric,
      target_value: target,
      timeframe,
    },
  };

  window.localStorage.setItem(keyFor(ideaId), JSON.stringify(data));
}

export function getExpectedOutcome(ideaId: string): ExpectedOutcomeRecord | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(keyFor(ideaId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ExpectedOutcomeRecord;
  } catch {
    return null;
  }
}
