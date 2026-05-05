// Types for the prompt registry. The registry is the single source of truth
// for prompt content + version. Actions become thin wrappers that render and
// pass the result to the existing callAI / backend route plumbing.

import type { ExpectedOutcome, ActualOutcome } from "../outcomeTypes";

// Prediction strictness lives here (not actions.ts) because the
// expected_outcome template needs it, and putting it in actions would create
// a runtime import cycle. Re-exported from actions.ts for back-compat.
export type PredictionStrictness = "conservative" | "balanced" | "aggressive";

export type PromptId =
  | "insight_extractor"
  | "suggest_direction"
  | "expected_outcome"
  | "prd_generator"
  | "task_generator"
  | "learning_insight";

// Var shape per prompt. Keeps callers honest at compile time.
export interface DecisionShapeForPrompt {
  title: string;
  summary?: string;
  justification: string;
  userStory: string;
}

export interface PromptVarsMap {
  insight_extractor: { content: string };
  suggest_direction: {
    pastIdeas?: string[];
    refinement?: string;
    // v2.7: signed calibration bias (-1..+1). When |bias| ≥ 0.05 the template
    // appends a calibration note steering the model toward conservative or
    // ambitious framing without changing the JSON schema or call count.
    calibrationBias?: number | null;
  };
  expected_outcome: {
    idea: string;
    decision: DecisionShapeForPrompt;
    insights?: string[];
    strictness: PredictionStrictness;
    calibrationBias?: number | null;
  };
  prd_generator: { title: string; notes: string; decisions: string };
  task_generator: { prdTitle?: string };
  learning_insight: {
    decisionLabel: string;
    expected: ExpectedOutcome;
    actual: ActualOutcome;
  };
}

export interface PromptDef<K extends PromptId = PromptId> {
  id: K;
  version: string;
  description: string;
  // "frontend" prompts are rendered by renderPrompt() and embedded in callAI.
  // "backend" prompts live in backend/src/services/groqService.ts — the
  // registry holds metadata only so versioning + descriptions stay in one
  // place. template() returns "" for backend entries; the action calls the
  // backend route as before.
  location: "frontend" | "backend";
  template: (vars: PromptVarsMap[K]) => string;
}

export interface RenderedPrompt {
  prompt: string;
  promptId: PromptId;
  version: string;
  // 10-char stable hash of the rendered prompt string. Forensic identifier
  // that lets us prove which exact prompt produced a stored output without
  // having to keep the full prompt text alongside it.
  hash: string;
}

// Lightweight reference persisted next to AI outputs (decision reasoning,
// agent runs, outcome records). Survives prompt-text rotations because it
// preserves the version + hash at the time the output was produced.
export interface PromptRef {
  id: PromptId;
  version: string;
  hash: string;
}

// Optional metadata payload for backend log correlation. Forward this through
// any layer that ferries prompts to the LLM proxy.
export interface PromptMeta {
  promptId: PromptId;
  promptVersion: string;
  promptHash?: string;
}
