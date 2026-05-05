// v2.4 auto-rollback guard.
//
// Watches per-(promptId, version) accuracy from getPromptOutcomeMetrics.
// If the currently-pinned version is materially worse than another version
// that has enough data, the system rolls back: subsequent renderPrompt()
// calls resolve to the previous winner instead of the pinned default.
//
// Design choices:
//   - Per-device persistence via localStorage. Per-user Firestore would let
//     rollbacks travel across devices but isn't worth the schema cost yet.
//   - Detection runs on demand (called from the agent + health panel), not
//     from a server cron. Backend cron would shift authority away from the
//     user's own outcomes; this keeps things deterministic from their data.
//   - Rollback decisions are observable: getRollbackDecisions() returns
//     them so the health panel can show "rolled back to vX (reason)".

import type { PromptId } from "./types";
import { PINNED_VERSIONS } from "./versions";

// Structural input shape — we don't import db.ts here to avoid pulling
// Firestore client code into the registry layer. The aggregation function
// in db.ts produces a superset of these fields.
export interface PromptOutcomeMetricsRow {
  promptId: string;
  promptVersion: string;
  runs: number;
  avgAccuracyNorm: number | null;
}

// Minimum runs before we trust an accuracy delta is real.
const MIN_RUNS_FOR_ROLLBACK = 30;
// Required accuracy delta (in [0,1] space) for rollback to fire.
const MIN_DEGRADATION = 0.05;

const STORAGE_KEY = "speckula:prompt-rollback-overrides:v1";

export interface RollbackDecision {
  promptId: PromptId;
  fromVersion: string;
  toVersion: string;
  pinnedAccuracy: number;
  rollbackAccuracy: number;
  delta: number;             // pinned - rolled = negative when pinned is worse
  pinnedRuns: number;
  rollbackRuns: number;
  decidedAt: string;         // ISO timestamp
}

// In-memory cache populated from localStorage on first read. Mutated by
// computeAndApplyRollbacks().
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
    const parsed = JSON.parse(raw) as { overrides?: Partial<Record<PromptId, string>>; decisions?: Record<string, RollbackDecision> };
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

// Read-side. Used by getVersionForUser().
export function getRollbackOverride(promptId: PromptId): string | undefined {
  ensureLoaded();
  return runtimeOverrides?.[promptId];
}

// Surface decisions for the health panel + UI hint.
export function getRollbackDecisions(): RollbackDecision[] {
  ensureLoaded();
  return Object.values(runtimeDecisions);
}

export function clearRollbacks(): void {
  runtimeOverrides = {};
  runtimeDecisions = {};
  persist();
}

// Core decision logic. Compares the pinned version's accuracy against every
// other version that has enough data; promotes the best historical performer
// when the pinned version trails it by >= MIN_DEGRADATION.
//
// Returns the array of new rollback decisions made on this call (so the
// caller can log / surface them). Existing rollbacks are preserved unless
// the data has shifted enough to dismiss them.
export function computeAndApplyRollbacks(metrics: PromptOutcomeMetricsRow[]): RollbackDecision[] {
  ensureLoaded();
  const newDecisions: RollbackDecision[] = [];

  // Group metrics by promptId for comparison.
  const byPrompt = new Map<string, PromptOutcomeMetricsRow[]>();
  for (const row of metrics) {
    const list = byPrompt.get(row.promptId) ?? [];
    list.push(row);
    byPrompt.set(row.promptId, list);
  }

  for (const [promptIdRaw, rows] of byPrompt.entries()) {
    const promptId = promptIdRaw as PromptId;
    if (!(promptId in PINNED_VERSIONS)) continue;
    const pinnedVersion = PINNED_VERSIONS[promptId];

    // Pinned-version row (if any data exists).
    const pinned = rows.find((r) => r.promptVersion === pinnedVersion);
    if (!pinned || pinned.runs < MIN_RUNS_FOR_ROLLBACK || pinned.avgAccuracyNorm === null) {
      // Not enough pinned-version data to judge. Don't dismiss any existing
      // override either — wait for more data.
      continue;
    }

    // Best alternative version with sufficient data.
    const candidates = rows.filter(
      (r) =>
        r.promptVersion !== pinnedVersion &&
        r.runs >= MIN_RUNS_FOR_ROLLBACK &&
        r.avgAccuracyNorm !== null
    );
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => (b.avgAccuracyNorm ?? 0) - (a.avgAccuracyNorm ?? 0));
    const best = candidates[0];

    const pinnedAcc = pinned.avgAccuracyNorm!;
    const bestAcc = best.avgAccuracyNorm!;
    const degradation = bestAcc - pinnedAcc;

    if (degradation >= MIN_DEGRADATION) {
      // Roll back.
      const decision: RollbackDecision = {
        promptId,
        fromVersion: pinnedVersion,
        toVersion: best.promptVersion,
        pinnedAccuracy: round3(pinnedAcc),
        rollbackAccuracy: round3(bestAcc),
        delta: round3(pinnedAcc - bestAcc),
        pinnedRuns: pinned.runs,
        rollbackRuns: best.runs,
        decidedAt: new Date().toISOString(),
      };

      const prev = runtimeDecisions[promptId];
      const isNew = !prev || prev.toVersion !== decision.toVersion;
      if (!runtimeOverrides) runtimeOverrides = {};
      runtimeOverrides[promptId] = best.promptVersion;
      runtimeDecisions[promptId] = decision;
      if (isNew) {
        newDecisions.push(decision);
        // eslint-disable-next-line no-console
        console.warn(
          `[rollback] ${promptId}: pinned ${pinnedVersion} (acc ${decision.pinnedAccuracy}, ${pinned.runs} runs) → rolling back to ${best.promptVersion} (acc ${decision.rollbackAccuracy}, ${best.runs} runs)`
        );
      }
    } else if (runtimeOverrides?.[promptId]) {
      // Pinned version recovered — clear the override.
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
