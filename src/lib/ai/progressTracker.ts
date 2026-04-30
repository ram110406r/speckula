export interface ProgressState {
  hasProblem: boolean;
  hasSolution: boolean;
  hasMetrics: boolean;
}

const PROGRESS_STORAGE_KEY = "Speckula-inline-ai-progress-v1";

const defaultProgress: ProgressState = {
  hasProblem: false,
  hasSolution: false,
  hasMetrics: false,
};

function safeParseProgress(raw: string | null): ProgressState {
  if (!raw) return { ...defaultProgress };

  try {
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    return {
      hasProblem: Boolean(parsed.hasProblem),
      hasSolution: Boolean(parsed.hasSolution),
      hasMetrics: Boolean(parsed.hasMetrics),
    };
  } catch {
    return { ...defaultProgress };
  }
}

export function getProgress(): ProgressState {
  if (typeof window === "undefined") {
    return { ...defaultProgress };
  }

  return safeParseProgress(window.localStorage.getItem(PROGRESS_STORAGE_KEY));
}

export function updateProgress(context: string): ProgressState {
  const progress = getProgress();
  const next: ProgressState = { ...progress };

  if (context.match(/problem|drop|issue|pain/i)) next.hasProblem = true;
  if (context.match(/solution|build|feature/i)) next.hasSolution = true;
  if (context.match(/metric|conversion|rate|kpi/i)) next.hasMetrics = true;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next));
  }

  return next;
}
