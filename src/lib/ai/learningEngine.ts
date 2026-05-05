import { callAI } from "./learningEngineSupport";
import {
  renderPrompt,
  validateLearningInsightText,
  withRetryOnParseFail,
} from "./promptLibrary";
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
  userId?: string;
}

export async function generateLearningInsight(input: LearningInsightInput): Promise<string> {
  const { decisionLabel, contextNarrative, expected, actual, userId } = input;
  const { prompt, promptId, version, hash } = renderPrompt(
    "learning_insight",
    { decisionLabel, expected, actual },
    { userId: userId ?? null }
  );
  return withRetryOnParseFail(async () => {
    const text = await callAI(prompt, contextNarrative ?? "", {
      promptId,
      promptVersion: version,
      promptHash: hash,
    });
    validateLearningInsightText(text);
    return text;
  });
}
