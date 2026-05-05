// Public surface of the prompt registry.

export { renderPrompt } from "./render";
export type { RenderOptions } from "./render";
export { REGISTRY } from "./registry";
export {
  PINNED_VERSIONS,
  userOverrides,
  setUserOverride,
  clearUserOverrides,
  getVersionForUser,
} from "./versions";
export { PM_VOICE_PROMPT } from "./persona";
export {
  PromptValidationError,
  validateDecisionSuggestions,
  validatePredictedOutcome,
  validateTaskList,
  validateLearningInsightText,
  withRetryOnParseFail,
} from "./validators";
export {
  computeAndApplyRollbacks,
  getRollbackDecisions,
  getRollbackOverride,
  clearRollbacks,
} from "./rollback";
export type {
  RollbackDecision,
  PromptOutcomeMetricsRow as RollbackInputRow,
} from "./rollback";
export type {
  PromptId,
  PromptDef,
  PromptVarsMap,
  RenderedPrompt,
  PromptRef,
  PromptMeta,
  DecisionShapeForPrompt,
  PredictionStrictness,
} from "./types";
