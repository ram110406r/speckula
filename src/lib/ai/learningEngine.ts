import { callAI } from "./learningEngineSupport";
import type { ActualOutcome, ExpectedOutcome } from "./outcomeTypes";

interface LearningInsightInput {
  // Short prose label for the decision (e.g. its title) — NOT the doc id.
  // Pass the decision's title or a one-line summary so the model has
  // something meaningful to reason about.
  decisionLabel: string;
  // Optional longer narrative describing the decision context (the
  // document content, justification, etc.). Passed as the "context"
  // payload to the AI call.
  contextNarrative?: string;
  expected: ExpectedOutcome;
  actual: ActualOutcome;
}

export async function generateLearningInsight(input: LearningInsightInput): Promise<string> {
  const { decisionLabel, contextNarrative, expected, actual } = input;
  const prompt = `
You are a senior product manager analyzing a launched decision against its expected outcome.

Decision: ${decisionLabel}

Expected ${expected.metric}${expected.unit ? ` (${expected.unit})` : ""}: ${expected.target_value} (${expected.timeframe})
Actual ${actual.metric}${actual.unit ? ` (${actual.unit})` : ""}: ${actual.value} (observed ${actual.observedAt})

Analyze:
* Why did this succeed or fail relative to the target?
* What assumption was wrong?
* What should be done next?

Return concise insights.
`;

  return callAI(prompt, contextNarrative ?? "");
}
