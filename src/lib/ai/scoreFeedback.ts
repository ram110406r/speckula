import { doc, getDoc, setDoc, serverTimestamp, type Timestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { auth } from "../firebase/config";
import type { OpportunityScoreState } from "./scoreEvolution";
import type { OutcomeFeedback } from "./outcomeTypes";
import {
  computeAccuracyNorm,
  computePredictionQuality,
  computeFinalAccuracy,
  computeCalibrationError,
  computeOutcomeValidity,
} from "./scoreEngine";

// Adjust confidence on a successful or failed launch. Guards against NaN
// inputs (e.g. when reading Firestore docs that omit confidence) so the
// score never propagates as NaN through the rest of the pipeline.
export function updateConfidenceScore(scoreData: OpportunityScoreState, success: boolean) {
  const current = Number.isFinite(scoreData.confidence) ? scoreData.confidence : 5;
  const nextConfidence = success
    ? Math.min(10, current + 1)
    : Math.max(1, current - 1);

  return {
    ...scoreData,
    confidence: nextConfidence,
  };
}

export async function persistOutcomeFeedback(
  feedback: OutcomeFeedback,
  updatedScore: OpportunityScoreState
): Promise<void> {
  // Outcomes belong under the user that owns the decision — the previous
  // top-level `decisions/{id}/outcomes` path orphaned every record because
  // decisions actually live at `users/{uid}/decisions/{id}`. We also use a
  // crypto.randomUUID() id (with timestamp fallback) so concurrent
  // submissions in the same millisecond don't overwrite each other.
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("Cannot record outcome feedback while signed out.");
  }
  const outcomeId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const outcomeRef = doc(
    db,
    "users", uid,
    "decisions", feedback.decisionId,
    "outcomes", outcomeId
  );
  // v2.2: full feedback signal — accuracyNorm + predictionQuality →
  // finalAccuracy, plus calibrationError. Persisted both on the outcome doc
  // (audit trail) and on the decision (denormalized for fast feedback queries).
  // v2.5: explicit `success = actual >= target` replaces the accuracyNorm>=0.5
  // proxy for hitRate. Assumes higher-is-better (the dominant case for product
  // metrics: DAU, retention, conversion). Lower-is-better metrics will need a
  // direction flag once the outcome flow supports it.
  const target = Number(feedback.expected.target_value);
  const actualValue = Number(feedback.actual.value);
  const baseline = feedback.expected.baseline ?? null;

  const accuracyNorm = computeAccuracyNorm(target, actualValue);
  const predictionQuality = computePredictionQuality(target, baseline);
  const finalAccuracy = computeFinalAccuracy(accuracyNorm, predictionQuality);
  const calibrationError = computeCalibrationError(updatedScore.confidence, accuracyNorm);
  const success =
    Number.isFinite(target) && Number.isFinite(actualValue) ? actualValue >= target : feedback.success;

  // v2.9 stability guard: read the decision once so we can verify the actual
  // wasn't recorded before the timeframe elapsed. Decisions saved before
  // outcomeRecordedAt existed still carry createdAt, so this works for
  // historical data too. Read failure → skip the too-early check (degrade
  // gracefully rather than refuse to record the outcome).
  const decisionRef = doc(db, "users", uid, "decisions", feedback.decisionId);
  let decisionStartMs: number | null = null;
  try {
    const decisionSnap = await getDoc(decisionRef);
    if (decisionSnap.exists()) {
      const data = decisionSnap.data() as { createdAt?: Timestamp };
      decisionStartMs = data.createdAt?.toMillis?.() ?? null;
    }
  } catch {
    /* permission / network — skip the elapsed check */
  }
  const observedAtParsed = Date.parse(feedback.actual.observedAt);
  const observedAtMs = Number.isFinite(observedAtParsed) ? observedAtParsed : null;
  const isValid = computeOutcomeValidity({
    timeframe: feedback.expected.timeframe,
    baseline,
    target,
    decisionStartMs,
    observedAtMs,
  });

  await setDoc(outcomeRef, {
    success,
    expected: feedback.expected,
    actual: feedback.actual,
    confidence: updatedScore.confidence,
    score: updatedScore.score,
    accuracyNorm,
    predictionQuality,
    finalAccuracy,
    calibrationError,
    isValid,
    createdAt: serverTimestamp(),
  });

  await setDoc(
    decisionRef,
    {
      confidence: updatedScore.confidence,
      score: updatedScore.score,
      accuracyNorm,
      predictionQuality,
      finalAccuracy,
      calibrationError,
      success,
      isValid,
      outcomeRecordedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
