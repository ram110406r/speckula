// Prompt registry. Single source of truth for every prompt the system sends
// to the LLM. Frontend templates are rendered here and passed to callAI.
// Backend templates (insight_extractor, prd_generator) live in
// backend/src/services/groqService.ts — the registry holds metadata only so
// version + description stay co-located.

import { PM_VOICE_PROMPT } from "./persona";
import { PINNED_VERSIONS } from "./versions";
import type { PromptDef, PromptId, PredictionStrictness } from "./types";

// ── Strictness phrasing for the expected_outcome template ───────────────────

const STRICTNESS_INSTRUCTIONS: Record<PredictionStrictness, string> = {
  conservative:
    "Strictness: CONSERVATIVE. Pick a target you are 80%+ likely to hit. Bias toward underpredict-and-overdeliver. Allow higher confidence (0.7–0.9 typical).",
  balanced:
    "Strictness: BALANCED. Pick a target that is realistic but stretches the team. Confidence reflects honest uncertainty (0.5–0.75 typical).",
  aggressive:
    "Strictness: AGGRESSIVE. Pick a target at the upper bound of plausible outcomes — what would happen if the assumptions are right? Confidence should be lower (0.3–0.6 typical) to reflect the wider distribution of outcomes.",
};

// Stub message returned by backend-resident prompt templates. The action that
// owns the corresponding LLM call does not consume this string — it calls the
// backend route directly.
const BACKEND_STUB =
  "[backend-resident prompt — see backend/src/services/groqService.ts]";

// v2.7 calibration-aware instruction block. Appended to suggest_direction
// and expected_outcome templates when the user's signed bias is large enough
// to warrant nudging the model. Empty string when bias is null, undefined,
// or within the dead zone (±5%) — keeps the rendered prompt byte-identical
// to the legacy version when there's no signal.
const CALIBRATION_DEAD_ZONE = 0.05;

function calibrationInstruction(bias: number | null | undefined): string {
  if (typeof bias !== "number" || !Number.isFinite(bias)) return "";
  if (Math.abs(bias) < CALIBRATION_DEAD_ZONE) return "";
  if (bias > 0) {
    return `\n\nCalibration note: your predictions have been overconfident historically. Prefer conservative estimates and highlight risks.`;
  }
  return `\n\nCalibration note: your predictions have been underconfident historically. Do not undershoot targets; consider stronger upside.`;
}

// Helper to keep entries narrow while indexing the broad PromptDef map type.
const def = <K extends PromptId>(d: PromptDef<K>): PromptDef<K> => d;

export const REGISTRY: { [K in PromptId]: PromptDef<K> } = {
  // ── 1. Insight Extractor ──────────────────────────────────────────────────
  insight_extractor: def<"insight_extractor">({
    id: "insight_extractor",
    version: PINNED_VERSIONS.insight_extractor,
    description:
      "Extract pain points, behaviors, segments, and opportunities from raw research notes.",
    location: "backend",
    template: () => BACKEND_STUB,
  }),

  // ── 2 + 3 + 4. Decision Generator (bundled with scoring + risk + cost) ────
  // Verbatim from suggestDirectionAction. memoryBlock and refinementBlock are
  // assembled from the vars and appended to the body so the rendered string
  // matches the legacy output exactly.
  suggest_direction: def<"suggest_direction">({
    id: "suggest_direction",
    version: PINNED_VERSIONS.suggest_direction,
    description:
      "Propose 3 candidate product directions with scoring (impact/effort/confidence/demand), risks, assumptions, and a production cost model. Bundled by design — splitting would 3–5× LLM round-trips per run.",
    location: "frontend",
    template: ({ pastIdeas, refinement, calibrationBias }) => {
      const memoryBlock =
        pastIdeas && pastIdeas.length > 0
          ? `\n\nThe user has explored these ideas recently. Avoid repeating the same weak framings — push for sharper angles:\n${pastIdeas.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}`
          : "";

      const refinementBlock = refinement
        ? `\n\nReflection note — your previous attempt was weak. ${refinement} Be sharper this time.`
        : "";

      const calibrationBlock = calibrationInstruction(calibrationBias);

      return `${PM_VOICE_PROMPT}

Based on these product notes, propose 3 distinct decisions the team could make next.

For each decision, return a JSON object with EXACTLY these keys:
- title: one-line decision title (max 80 chars, no trailing period)
- summary: 1-2 sentences. What the decision is, in plain language.
- justification: short paragraph (max 4 sentences). Why this is worth doing, grounded in the notes.
- userStory: "As a [specific user], I want to [action], so that [outcome]."
- tradeoffs: short paragraph naming the real cost or constraint.
- why: array of 3 short bullets — the strongest reasons to pick this. Each bullet < 100 chars.
- risks: array of 2 short bullets — the most likely failure modes. Each bullet < 100 chars.
- assumptions: array of 2-3 short bullets — the hidden assumptions this decision depends on. Each must be falsifiable. (e.g. "Users will pay $5/mo for this", not "users will love it")
- keyInsight: ONE contrarian or non-obvious insight that a typical PM would miss. Specific, not generic.
- recommendation: ONE sentence prescribing the next concrete action. Starts with a verb.
- impact: integer 1-10 (10 = moves a core metric materially)
- effort: integer 1-10 (10 = months of work)
- confidence: integer 1-10 (10 = validated by multiple users + data; 1 = pure hunch)
- demand: integer 1-10 (10 = top requested feature, strong market signal; 1 = no evidence of user interest)
- priority: "high" | "medium" | "low"
- costModel: {
    "category": "LOW" | "MEDIUM" | "HIGH",
    "estimatedMonthly": number (USD baseline at small scale — 1-10 users or ~1k daily requests),
    "breakdown": { "infrastructure": number, "llm_api": number, "ops_labor": number },
    "scalingTrajectory": "1 sentence: how does cost grow from 100 to 10k users?",
    "costDrivers": ["top cost factor 1", "top cost factor 2"],
    "riskFactors": ["cost uncertainty 1"]
  }
  Cost categories: LOW = <$500/mo baseline, MEDIUM = $500–$2k/mo, HIGH = >$2k/mo.
  costModel must reflect THIS direction's specific technical approach — not a generic estimate.

Hard rules:
- Be specific. "Improve user experience" is not an insight or a recommendation.
- Risks and assumptions must be falsifiable, not generic.
- If the notes are too thin to support a claim, lower confidence and priority — do not invent evidence.${memoryBlock}${refinementBlock}${calibrationBlock}

Return ONLY a JSON array of 3 objects. No prose, no markdown fences.`;
    },
  }),

  // ── 5. Expected Outcome Predictor ─────────────────────────────────────────
  expected_outcome: def<"expected_outcome">({
    id: "expected_outcome",
    version: PINNED_VERSIONS.expected_outcome,
    description:
      "Predict ONE measurable outcome (metric, baseline, target, timeframe, confidence) for the top candidate direction. Strictness mode shapes target ambition.",
    location: "frontend",
    template: ({ idea, decision, insights, strictness, calibrationBias }) => {
      const insightsBlock =
        insights && insights.length > 0
          ? `\n\nKey insights from the notes:\n${insights.slice(0, 5).map((i) => `- ${i}`).join("\n")}`
          : "";

      const decisionSummary = decision.summary || decision.justification;
      const calibrationBlock = calibrationInstruction(calibrationBias);

      return `${PM_VOICE_PROMPT}

Predict ONE measurable outcome for this product decision. The team must be able to verify whether the bet worked after launch.

${STRICTNESS_INSTRUCTIONS[strictness]}

Idea: ${idea}
Decision: ${decision.title}
${decisionSummary}
User story: ${decision.userStory}${insightsBlock}

Pick ONE primary metric that would clearly demonstrate success. Estimate:
- baseline: current value (best guess based on the notes; null if truly unknown)
- target: realistic value to hit, calibrated to the strictness above
- timeframe_days: integer days post-launch to measure (7–90)
- confidence: 0.0–1.0 — how certain are YOU in this prediction
- unit: short unit string ("%", "DAU", "$/mo")
- rationale: ONE short sentence explaining why this metric, target, and confidence

Hard rules:
- metric must be specific ("Activation Rate" not "user engagement")
- target must be a realistic delta from baseline
- if baseline is unknown, set baseline=null and lower confidence accordingly
- timeframe_days must be between 7 and 90

Return ONLY this JSON, no prose, no markdown fences:
{
  "metric": "Activation Rate",
  "baseline": 12,
  "target": 25,
  "timeframe_days": 30,
  "confidence": 0.68,
  "unit": "%",
  "rationale": "..."
}${calibrationBlock}`;
    },
  }),

  // ── 6. PRD Generator (backend-resident) ───────────────────────────────────
  prd_generator: def<"prd_generator">({
    id: "prd_generator",
    version: PINNED_VERSIONS.prd_generator,
    description:
      "Generate a full PRD (problem, solution, success metrics, risks, timeline) from research notes and a chosen decision.",
    location: "backend",
    template: () => BACKEND_STUB,
  }),

  // ── 7. Task Generator ─────────────────────────────────────────────────────
  task_generator: def<"task_generator">({
    id: "task_generator",
    version: PINNED_VERSIONS.task_generator,
    description:
      "Decompose a PRD into 5–7 implementation tasks with priority, effort, category, and PRD-section linkage.",
    location: "frontend",
    template: ({ prdTitle }) =>
      `Convert this PRD into 5-7 concrete, actionable implementation tasks.

PRD Title:
${prdTitle ?? "Untitled PRD"}

Instructions:
- Each task must be specific and measurable
- Include details about implementation approach
- Assign a category: backend, frontend, design, qa, integration, or devops
- For each task, identify which PRD section it relates to
- Estimate effort on 1-10 scale

Output ONLY a JSON array with this structure:
[
  {
    "title": "Task name",
    "description": "Detailed what to do and how",
    "priority": "high|medium|low",
    "effort": 1-10,
    "category": "backend|frontend|design|qa|integration|devops",
    "prdSection": "Which PRD section this implements",
    "milestone": "Optional milestone name"
  }
]`,
  }),

  // ── 9. Learning Insight Generator ─────────────────────────────────────────
  // (No #8 outcome_comparator — that comparison is deterministic by design,
  //  see src/lib/ai/comparisonEngine.ts. v2.1+ avoids an LLM call there.)
  learning_insight: def<"learning_insight">({
    id: "learning_insight",
    version: PINNED_VERSIONS.learning_insight,
    description:
      "Post-launch reflection: explain why the actual outcome diverged from the expected, name the wrong assumption, and recommend a next step.",
    location: "frontend",
    template: ({ decisionLabel, expected, actual }) =>
      `
You are a senior product manager analyzing a launched decision against its expected outcome.

Decision: ${decisionLabel}

Expected ${expected.metric}${expected.unit ? ` (${expected.unit})` : ""}: ${expected.target_value} (${expected.timeframe})
Actual ${actual.metric}${actual.unit ? ` (${actual.unit})` : ""}: ${actual.value} (observed ${actual.observedAt})

Analyze:
* Why did this succeed or fail relative to the target?
* What assumption was wrong?
* What should be done next?

Return concise insights.
`,
  }),
};
