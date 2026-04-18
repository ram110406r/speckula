import type { OpportunityScoreBreakdown } from "./scoreEngine";

export interface OpportunityScoreHistoryEntry {
  timestamp: number;
  score: number;
  breakdown: OpportunityScoreBreakdown;
}

interface OpportunityScoreHistoryRecord {
  ideaId: string;
  history: OpportunityScoreHistoryEntry[];
}

const STORAGE_PREFIX = "buildcase-opportunity-score-v1";

function historyKey(ideaId: string) {
  return `${STORAGE_PREFIX}:${ideaId}`;
}

export function getScoreHistory(ideaId: string): OpportunityScoreHistoryEntry[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(historyKey(ideaId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as OpportunityScoreHistoryRecord;
    return Array.isArray(parsed.history) ? parsed.history : [];
  } catch {
    return [];
  }
}

export function recordScoreHistory(ideaId: string, entry: OpportunityScoreHistoryEntry) {
  if (typeof window === "undefined") return;

  const current = getScoreHistory(ideaId);
  const next = [...current, entry].slice(-30);
  const payload: OpportunityScoreHistoryRecord = { ideaId, history: next };
  window.localStorage.setItem(historyKey(ideaId), JSON.stringify(payload));
}
