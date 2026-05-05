// v2.5 auto-rollback guard — rolling-window edition.
//
// For each promptId, partitions recent outcomes by recordedAt and compares
// the most recent batch against the prior batch. Triggers a rollback only
// when the recent batch trails the prior one by a meaningful margin AND
// both windows have enough data to be statistically meaningful.
//
// Why rolling instead of best-historical: a prompt that briefly performed
// well in the distant past shouldn't permanently shadow a working current
// version after a single noisy week. Rolling self-heals — when the pinned
// version recovers, the rollback clears.
//
// Persistence:
//   - In-memory map (fast read for getVersionForUser)
//   - localStorage mirror (offline fallback)
//   - Firestore (authoritative, cross-device) — written by the agent layer
//     after computeAndApplyRollbacks returns its decisions

import type { PromptId } from "./types";
import { PINNED_VERSIONS } from "./versions";

// Structural input shape for samples — kept minimal so this module stays
// independent of the Firestore-shaped OutcomeSample in db.ts.
export interface RollbackSample {
  promptVersion: string;
  accuracyNorm: number;
  recordedAt: number;
}

// Structural row shape, retained for legacy callers. Only used by the
// internal panel's rollback summary; not part of the rolling algorithm.
export interface PromptOutcomeMetricsRow {
  promptId: string;
  promptVersion: string;
  runs: number;
  avgAccuracyNorm: number | null;
}

const WINDOW_SIZE = 30;
const MIN_DEGRADATION = 0.05;

const STORAGE_KEY = "speckula:prompt-rollback-overrides:v2";

export interface RollbackDecision {
  promptId: PromptId;
  fromVersion: string;            // the pinned version that's underperforming
  toVersion: string;              // the previous-window winner we're rolling back to
  recentAccuracy: number;         // avg accuracy across the most recent 30 outcomes
  previousAccuracy: number;       // avg accuracy across runs 31–60
  delta: number;                  // recent − previous (negative when rolling back)
  recentRuns: number;
  previousRuns: number;
  decidedAt: string;              // ISO timestamp
}

let runtimeOverrides: Partial<Record<PromptId, string>> | null = null;
let runtimeDecisions: Record<string, RollbackDecision> = {};

function ensureLoaded(): void {
  if (runtimeOverrides !== null) return;
  if (typeof window === "undefined") {
    runtimeOverrides = {};
    return;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      runtimeOverrides = {};
      return;
    }
    const parsed = JSON.parse(raw) as {
      overrides?: Partial<Record<PromptId, string>>;
      decisions?: Record<string, RollbackDecision>;
    };
    runtimeOverrides = parsed.overrides ?? {};
    runtimeDecisions = parsed.decisions ?? {};
  } catch {
    runtimeOverrides = {};
    runtimeDecisions = {};
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ overrides: runtimeOverrides ?? {}, decisions: runtimeDecisions })
    );
  } catch {
    /* localStorage full / disabled — accept ephemeral overrides */
  }
}

// Read-side. Used by getVersionForUser() and the UI hint.
export function getRollbackOverride(promptId: PromptId): string | undefined {
  ensureLoaded();
  return runtimeOverrides?.[promptId];
}

export function getRollbackDecisions(): RollbackDecision[] {
  ensureLoaded();
  return Object.values(runtimeDecisions);
}

export function clearRollbacks(): void {
  runtimeOverrides = {};
  runtimeDecisions = {};
  persist();
}

// Apply an override that came from an authoritative source (e.g. Firestore).
// Used by the agent during its startup hydration step.
export function hydrateRollbackOverrides(
  overrides: Partial<Record<PromptId, string>>,
  decisions?: Record<string, RollbackDecision>
): void {
  ensureLoaded();
  runtimeOverrides = { ...runtimeOverrides, ...overrides };
  if (decisions) runtimeDecisions = { ...runtimeDecisions, ...decisions };
  persist();
}

// Determine the dominant version in a window of samples — used to pick the
// rollback target when multiple versions are present in the previous window.
function dominantVersion(samples: RollbackSample[]): { version: string; runs: number } | null {
  const counts = new Map<string, number>();
  for (const s of samples) counts.set(s.promptVersion, (counts.get(s.promptVersion) ?? 0) + 1);
  let winner: { version: string; runs: number } | null = null;
  for (const [v, n] of counts.entries()) {
    if (!winner || n > winner.runs) winner = { version: v, runs: n };
  }
  return winner;
}

// Rolling-window comparison. Recent = last WINDOW_SIZE samples by recordedAt.
// Previous = the next WINDOW_SIZE before that. Both windows need to be full
// before any rollback fires — partial data isn't trustworthy.
//
// Returns the array of NEW rollback decisions (so the caller can persist them
// to Firestore). Existing decisions are kept unless self-healed.
export function computeAndApplyRollbacks(
  samplesByPromptId: Record<string, RollbackSample[]>
): RollbackDecision[] {
  ensureLoaded();
  const newDecisions: RollbackDecision[] = [];

  for (const [promptIdRaw, samples] of Object.entries(samplesByPromptId)) {
    const promptId = promptIdRaw as PromptId;
    if (!(promptId in PINNED_VERSIONS)) continue;

    // Samples should arrive in DESC order. Defensive sort.
    const ordered = [...samples].sort((a, b) => b.recordedAt - a.recordedAt);
    if (ordered.length < WINDOW_SIZE * 2) {
      // Not enough data for both windows — leave the override state alone so
      // we neither create nor dismiss anything until we have signal.
      continue;
    }

    const recent = ordered.slice(0, WINDOW_SIZE);
    const previous = ordered.slice(WINDOW_SIZE, WINDOW_SIZE * 2);

    const avg = (xs: RollbackSample[]) => xs.reduce((s, x) => s + x.accuracyNorm, 0) / xs.length;
    const recentAccuracy = avg(recent);
    const previousAccuracy = avg(previous);
    const delta = recentAccuracy - previousAccuracy;

    if (delta < -MIN_DEGRADATION) {
      // Rollback target = dominant version in the previous window. We don't
      // pick "best historical" because a long-dead version with great early
      // numbers shouldn't override a working previous-batch version.
      const target = dominantVersion(previous);
      const pinnedVersion = PINNED_VERSIONS[promptId];
      if (!target || target.version === pinnedVersion) continue;

      const decision: RollbackDecision = {
        promptId,
        fromVersion: pinnedVersion,
        toVersion: target.version,
        recentAccuracy: round3(recentAccuracy),
        previousAccuracy: round3(previousAccuracy),
        delta: round3(delta),
        recentRuns: recent.length,
        previousRuns: previous.length,
        decidedAt: new Date().toISOString(),
      };

      const prev = runtimeDecisions[promptId];
      const isNew = !prev || prev.toVersion !== decision.toVersion;
      if (!runtimeOverrides) runtimeOverrides = {};
      runtimeOverrides[promptId] = target.version;
      runtimeDecisions[promptId] = decision;
      if (isNew) {
        newDecisions.push(decision);
        // eslint-disable-next-line no-console
        console.warn(
          `[rollback] ${promptId}: recent ${WINDOW_SIZE} runs (acc ${decision.recentAccuracy}) trail prior ${WINDOW_SIZE} (acc ${decision.previousAccuracy}). Rolling ${pinnedVersion} → ${target.version}.`
        );
      }
    } else if (runtimeOverrides?.[promptId]) {
      // Self-heal: pinned version recovered (recent ≥ previous − threshold).
      delete runtimeOverrides[promptId];
      delete runtimeDecisions[promptId];
    }
  }

  persist();
  return newDecisions;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
