export interface ActualOutcome {
  metric: string;
  value: number;
  timestamp: number;
}

export interface ActualOutcomeRecord {
  ideaId: string;
  actual: ActualOutcome;
}

const STORAGE_PREFIX = "buildcase-actual-outcome-v1";

function keyFor(ideaId: string) {
  return `${STORAGE_PREFIX}:${ideaId}`;
}

export function recordActualOutcome(ideaId: string, metric: string, value: number) {
  if (typeof window === "undefined") return;

  const data: ActualOutcomeRecord = {
    ideaId,
    actual: {
      metric,
      value,
      timestamp: Date.now(),
    },
  };

  window.localStorage.setItem(keyFor(ideaId), JSON.stringify(data));
}

export function getActualOutcome(ideaId: string): ActualOutcomeRecord | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(keyFor(ideaId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ActualOutcomeRecord;
  } catch {
    return null;
  }
}
