// Strict validators for parsed LLM outputs. These run AFTER the existing
// `normalize*` defaulting pass — their job is to fail closed when the model
// returned a structurally degraded response (empty array, missing required
// fields, wrong shape) so the action layer can retry once before throwing.
//
// Lightweight by design — no Zod dep on the frontend. Each validator throws
// with a short, action-friendly reason that bubbles into the retry loop.

export class PromptValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptValidationError";
  }
}

// suggest_direction → DecisionSuggestion[]. Must be a non-empty array of
// objects with at least a non-empty title and a numeric impact/effort.
export function validateDecisionSuggestions(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new PromptValidationError("decision response was not an array");
  }
  if (value.length === 0) {
    throw new PromptValidationError("decision response was empty");
  }
  for (let i = 0; i < value.length; i++) {
    const d = value[i] as { title?: unknown; impact?: unknown; effort?: unknown };
    const title = typeof d.title === "string" ? d.title.trim() : "";
    if (!title) throw new PromptValidationError(`decision[${i}] missing title`);
    if (!Number.isFinite(Number(d.impact))) {
      throw new PromptValidationError(`decision[${i}] missing numeric impact`);
    }
    if (!Number.isFinite(Number(d.effort))) {
      throw new PromptValidationError(`decision[${i}] missing numeric effort`);
    }
  }
}

// expected_outcome → PredictedOutcome. metric required, target finite,
// timeframe finite, confidence in [0,1].
export function validatePredictedOutcome(value: unknown): void {
  if (!value || typeof value !== "object") {
    throw new PromptValidationError("outcome response was not an object");
  }
  const o = value as { metric?: unknown; target?: unknown; timeframeDays?: unknown; timeframe_days?: unknown; confidence?: unknown };
  if (typeof o.metric !== "string" || o.metric.trim().length === 0) {
    throw new PromptValidationError("outcome missing metric");
  }
  if (!Number.isFinite(Number(o.target))) {
    throw new PromptValidationError("outcome missing numeric target");
  }
  const tf = Number(o.timeframeDays ?? o.timeframe_days);
  if (!Number.isFinite(tf)) {
    throw new PromptValidationError("outcome missing numeric timeframe");
  }
  const conf = Number(o.confidence);
  if (!Number.isFinite(conf) || conf < 0 || conf > 1) {
    throw new PromptValidationError("outcome confidence out of [0,1]");
  }
}

// task_generator → array of tasks; each must have a non-empty title.
export function validateTaskList(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new PromptValidationError("task response was not an array");
  }
  if (value.length === 0) {
    throw new PromptValidationError("task response was empty");
  }
  for (let i = 0; i < value.length; i++) {
    const t = value[i] as { title?: unknown };
    if (typeof t.title !== "string" || t.title.trim().length === 0) {
      throw new PromptValidationError(`task[${i}] missing title`);
    }
  }
}

// learning_insight → free-form text. Must be non-empty after trim.
export function validateLearningInsightText(text: string): void {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new PromptValidationError("learning insight was empty");
  }
}

// Generic single-retry helper. Runs the producer; if it throws a parse or
// validation error, retries exactly once. Anything else (network, abort,
// rate-limit) propagates immediately so we don't burn quota on permanent
// failures.
export async function withRetryOnParseFail<T>(
  produce: () => Promise<T>,
  isRetriable: (err: unknown) => boolean = defaultIsRetriable
): Promise<T> {
  try {
    return await produce();
  } catch (err) {
    if (!isRetriable(err)) throw err;
    // Single retry. If this throws, it propagates.
    return await produce();
  }
}

function defaultIsRetriable(err: unknown): boolean {
  if (err instanceof PromptValidationError) return true;
  const msg = err instanceof Error ? err.message : "";
  // The custom JSON extractor throws "AI did not return valid JSON" — treat
  // that the same as a structural validation failure.
  return msg.includes("did not return valid JSON") || msg.includes("was not an array");
}
