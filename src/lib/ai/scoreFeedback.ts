import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { auth } from "../firebase/config";
import type { OpportunityScoreState } from "./scoreEvolution";
import type { OutcomeFeedback } from "./outcomeTypes";
import {
  computeAccuracyNorm,
  computePredictionQuality,
  computeFinalAccuracy,
  computeCalibrationError,
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
  const target = Number(feedback.expected.target_value);
  const actualValue = Number(feedback.actual.value);
  const baseline = feedback.expected.baseline ?? null;

  const accuracyNorm = computeAccuracyNorm(target, actualValue);
  const predictionQuality = computePredictionQuality(target, baseline);
  const finalAccuracy = computeFinalAccuracy(accuracyNorm, predictionQuality);
  const calibrationError = computeCalibrationError(updatedScore.confidence, accuracyNorm);

  await setDoc(outcomeRef, {
    success: feedback.success,
    expected: feedback.expected,
    actual: feedback.actual,
    confidence: updatedScore.confidence,
    score: updatedScore.score,
    accuracyNorm,
    predictionQuality,
    finalAccuracy,
    calibrationError,
    createdAt: serverTimestamp(),
  });

  const decisionRef = doc(db, "users", uid, "decisions", feedback.decisionId);
  await setDoc(
    decisionRef,
    {
      confidence: updatedScore.confidence,
      score: updatedScore.score,
      accuracyNorm,
      predictionQuality,
      finalAccuracy,
      calibrationError,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
