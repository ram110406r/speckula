import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import type { OpportunityScoreState } from "./scoreEvolution";
import type { OutcomeFeedback } from "./outcomeTypes";

export function updateConfidenceScore(scoreData: OpportunityScoreState, success: boolean) {
  const nextConfidence = success
    ? Math.min(10, scoreData.confidence + 1)
    : Math.max(0, scoreData.confidence - 1);

  return {
    ...scoreData,
    confidence: nextConfidence,
  };
}

export async function persistOutcomeFeedback(
  feedback: OutcomeFeedback,
  updatedScore: OpportunityScoreState
): Promise<void> {
  const timestamp = Date.now();
  const outcomeRef = doc(db, "decisions", feedback.decisionId, "outcomes", String(timestamp));
  await setDoc(outcomeRef, {
    success: feedback.success,
    expected: feedback.expected,
    actual: feedback.actual,
    confidence: updatedScore.confidence,
    score: updatedScore.score,
    createdAt: serverTimestamp(),
  });

  const decisionRef = doc(db, "decisions", feedback.decisionId);
  await setDoc(
    decisionRef,
    {
      confidence: updatedScore.confidence,
      score: updatedScore.score,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
