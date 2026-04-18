import { callAI } from "./learningEngineSupport";
import type { ActualOutcome } from "./actualOutcome";
import type { ExpectedOutcome } from "./expectedOutcome";

export async function generateLearningInsight(context: string, expected: ExpectedOutcome, actual: ActualOutcome) {
  const prompt = `
You are a senior product manager.

Expected:
${expected.target_value}

Actual:
${actual.value}

Analyze:
* Why did this succeed or fail?
* What assumption was wrong?
* What should be done next?

Return concise insights.
`;

  return callAI(prompt, context);
}
