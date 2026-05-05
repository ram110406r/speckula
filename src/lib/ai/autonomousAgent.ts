// Frontend-orchestrated autonomous-mode agent (v2.2).
//
// 14-state machine. v2.2 closes 3 feedback gaps on top of v2.1:
//   1. Prediction quality (low-ambition wins no longer game the loop)
//   2. Pattern-level learning (per-metric accuracy adjusts the top decision)
//   3. Confidence calibration (overconfident users get squeezed harder)
// Plus prediction strictness (conservative / balanced / aggressive).

import {
  suggestDirectionAction,
  strategicGuidanceAction,
  clarifyIdeaAction,
  generateRoadmapAction,
  predictOutcomeAction,
  type DecisionSuggestion,
  type StrategicGuidance,
  type RoadmapPhase,
  type ClarifyingQuestion,
  type PredictedOutcome,
  type PredictionStrictness,
} from "./actions";
import {
  computeVerdict,
  pickTopDecision,
  collectAssumptions,
  reflectionInstructionFor,
  type Verdict,
} from "./verdict";
import { adjustedConfidence, type AccuracyContext } from "./scoreEngine";
import { renderPrompt } from "./promptLibrary";
import type { PromptRef } from "./promptLibrary";
import { savePastRun, getRecentPastRuns, getUserFeedbackSignals } from "../firebase/db";

export type AgentState =
  | "idle"
  | "understand_idea"
  | "check_clarity"
  | "awaiting_user"
  | "generate_decisions"
  | "reflection"
  | "evaluate_decisions"
  | "validation_layer"
  | "predict_outcome"
  | "confidence_gate"
  | "strategy_generation"
  | "roadmap_generation"
  | "output"
  | "stopped"
  | "error";

export type AgentDepth = "quick" | "standard" | "deep";

export interface ConfidenceExplanationItem {
  label: string;            // e.g. "Strong past accuracy"
  delta: number;            // -15..+15 (signed % change)
  scope: "user" | "pattern" | "calibration";
}

export type AgentEvent =
  | { type: "state"; state: AgentState; label: string }
  | { type: "thinking"; message: string }
  | { type: "checkpoint"; message: string }
  | { type: "question"; question: ClarifyingQuestion }
  | { type: "decisions"; decisions: DecisionSuggestion[] }
  | { type: "strategy"; strategy: StrategicGuidance }
  | { type: "roadmap"; roadmap: RoadmapPhase[] }
  | { type: "assumptions"; assumptions: string[] }
  | { type: "verdict"; verdict: Verdict }
  | { type: "topDecision"; decision: DecisionSuggestion }
  | { type: "memoryLoaded"; pastIdeas: string[] }
  | { type: "expectedOutcome"; outcome: PredictedOutcome }
  | { type: "feedbackApplied"; userAccuracy: number }
  | { type: "confidenceExplanation"; items: ConfidenceExplanationItem[] }
  | { type: "error"; message: string }
  | { type: "done" };

export interface AgentRunOptions {
  idea: string;
  depth: AgentDepth;
  signal: AbortSignal;
  emit: (event: AgentEvent) => void;
  awaitUserResponse: (question: ClarifyingQuestion) => Promise<string>;
  alreadyAsked: string[];
  userId?: string;
  // v2.2: tone the prediction step. Defaults to "balanced".
  strictness?: PredictionStrictness;
}

const stateLabels: Record<AgentState, string> = {
  idle: "Idle",
  understand_idea: "Identifying target users and core problem…",
  check_clarity: "Checking what's missing…",
  awaiting_user: "Needs clarification",
  generate_decisions: "Generating 3 candidate directions with cost models…",
  reflection: "Re-evaluating approach — checking cost assumptions and confidence…",
  evaluate_decisions: "Scoring impact, effort, confidence, demand, and cost viability…",
  validation_layer: "Detecting risky assumptions, blockers, and cost overruns…",
  predict_outcome: "Predicting a measurable outcome — metric, target, timeframe…",
  confidence_gate: "Validating the strongest direction before proceeding…",
  strategy_generation: "Defining strategic focus and cost constraints…",
  roadmap_generation: "Drafting a 3-phase roadmap with budget estimates…",
  output: "Done",
  stopped: "Stopped",
  error: "Error",
};

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    const err = new Error("Aborted");
    err.name = "AbortError";
    throw err;
  }
}

// Apply the deterministic feedback signal to every direction's confidence.
// Pattern factor is intentionally NOT applied here — we don't know the metric
// for each candidate yet, so pattern-level learning is applied only to the
// top decision after prediction.
function applyFeedbackToDecisions(
  decisions: DecisionSuggestion[],
  ctx: Pick<AccuracyContext, "userAccuracy" | "calibrationError">
): DecisionSuggestion[] {
  return decisions.map((d) => {
    if (typeof d.confidence !== "number" || !Number.isFinite(d.confidence)) return d;
    return { ...d, confidence: adjustedConfidence(d.confidence, ctx) };
  });
}

// Build the "Why was confidence adjusted?" explanation rows the UI surfaces.
function buildExplanation(args: {
  userAccuracy: number | null;
  calibrationError: number | null;
  patternAccuracy?: number | null;
  patternKey?: string;
}): ConfidenceExplanationItem[] {
  const items: ConfidenceExplanationItem[] = [];

  if (args.userAccuracy !== null && Number.isFinite(args.userAccuracy)) {
    const delta = Math.round((args.userAccuracy - 0.5) * 30);
    if (Math.abs(delta) >= 1) {
      items.push({
        label: args.userAccuracy >= 0.5 ? "Strong past accuracy" : "Weak past accuracy",
        delta,
        scope: "user",
      });
    }
  }

  if (
    args.patternAccuracy !== null &&
    args.patternAccuracy !== undefined &&
    Number.isFinite(args.patternAccuracy)
  ) {
    const delta = Math.round((args.patternAccuracy - 0.5) * 40);
    if (Math.abs(delta) >= 1 && args.patternKey) {
      items.push({
        label:
          args.patternAccuracy >= 0.5
            ? `Validated pattern: ${args.patternKey}`
            : `Weak pattern: ${args.patternKey}`,
        delta,
        scope: "pattern",
      });
    }
  }

  if (args.calibrationError !== null && Number.isFinite(args.calibrationError) && args.calibrationError! > 0.05) {
    // calibrationError 0–1 maps linearly to a 0..−20% penalty.
    const delta = -Math.round(args.calibrationError! * 20);
    if (Math.abs(delta) >= 1) {
      items.push({
        label: "High past calibration error",
        delta,
        scope: "calibration",
      });
    }
  }

  return items;
}

export async function runAutonomousAgent({
  idea,
  depth,
  signal,
  emit,
  awaitUserResponse,
  alreadyAsked,
  userId,
  strictness = "balanced",
}: AgentRunOptions): Promise<void> {
  const enterState = (state: AgentState) => {
    throwIfAborted(signal);
    emit({ type: "state", state, label: stateLabels[state] });
  };

  let context = idea.trim();
  const askedQuestions = [...alreadyAsked];
  const maxClarifications = depth === "quick" ? 0 : depth === "standard" ? 1 : 2;

  // Memory + feedback retrieval. One Firestore round-trip; failure is silent.
  let pastIdeas: string[] = [];
  let userAccuracy: number | null = null;
  let calibrationError: number | null = null;
  let patternAccuracies: Record<string, number> = {};

  if (userId) {
    try {
      const [pastRuns, signals] = await Promise.all([
        getRecentPastRuns(userId, 3),
        getUserFeedbackSignals(userId, 12),
      ]);
      pastIdeas = pastRuns.map((run) => run.idea).filter((s) => s.length > 0);
      userAccuracy = signals.userAccuracy;
      calibrationError = signals.calibrationError;
      patternAccuracies = signals.patternAccuracies;

      if (pastIdeas.length > 0) {
        emit({ type: "memoryLoaded", pastIdeas });
        emit({
          type: "thinking",
          message: `Pulled ${pastIdeas.length} recent run${pastIdeas.length === 1 ? "" : "s"} from memory — will avoid repeating weak framings.`,
        });
      }
      if (userAccuracy !== null) {
        emit({ type: "feedbackApplied", userAccuracy });
        const pct = Math.round(userAccuracy * 100);
        emit({
          type: "thinking",
          message: `Past-decision accuracy: ${pct}%. Confidence will be ${userAccuracy >= 0.5 ? "boosted" : "penalized"}.`,
        });
      }
      if (calibrationError !== null && calibrationError > 0.3) {
        emit({
          type: "thinking",
          message: `High past calibration error (${(calibrationError * 100).toFixed(0)}%) — past confidence didn't track outcomes. Squeezing further.`,
        });
      }
    } catch (error) {
      console.warn("[autonomousAgent] memory/feedback load failed:", error);
    }
  }

  try {
    // 1. UNDERSTAND_IDEA
    enterState("understand_idea");
    emit({
      type: "thinking",
      message: "Reading the raw idea. Pulling out the implied user, the friction, and the metric that would prove it works.",
    });

    // 2–3. CHECK_CLARITY + AWAIT_USER
    for (let round = 0; round < maxClarifications; round++) {
      enterState("check_clarity");
      const question = await clarifyIdeaAction(context, "", askedQuestions);
      throwIfAborted(signal);

      if (!question) {
        emit({ type: "thinking", message: "No critical gaps. Moving to direction generation." });
        break;
      }

      emit({ type: "question", question });
      enterState("awaiting_user");
      const answer = await awaitUserResponse(question);
      throwIfAborted(signal);

      askedQuestions.push(question.question);
      context = `${context}\n\nQ: ${question.question}\nA: ${answer.trim()}`;
    }

    // 4. GENERATE_DECISIONS — with cost models, then user-level + calibration
    //    feedback adjustment. Pattern factor is held back until predict_outcome.
    enterState("generate_decisions");
    emit({
      type: "thinking",
      message: "Drafting 3 candidate directions — each with assumptions, risks, and a production cost model.",
    });
    // Snapshot the prompt fingerprint alongside the call. Re-rendering is
    // deterministic and microsecond-cheap; we use it for forensic logging.
    const directionsRefRaw = renderPrompt(
      "suggest_direction",
      { pastIdeas, refinement: undefined },
      { userId: userId ?? null }
    );
    const directionsPromptRef: PromptRef = {
      id: directionsRefRaw.promptId,
      version: directionsRefRaw.version,
      hash: directionsRefRaw.hash,
    };
    let decisions = await suggestDirectionAction(userId ?? "", context, { pastIdeas });
    throwIfAborted(signal);
    decisions = applyFeedbackToDecisions(decisions, { userAccuracy, calibrationError });
    emit({ type: "decisions", decisions });
    emit({ type: "checkpoint", message: `${decisions.length} directions generated` });

    // 5. EVALUATE_DECISIONS
    enterState("evaluate_decisions");
    emit({
      type: "thinking",
      message: `Scored ${decisions.length} candidates on impact, effort, confidence, demand, and cost viability.`,
    });

    // 6. VALIDATION_LAYER + REFLECTION
    enterState("validation_layer");
    const totalRisks = decisions.reduce((sum, d) => sum + (d.risks?.length ?? 0), 0);
    emit({
      type: "thinking",
      message: `Detected ${totalRisks} risk${totalRisks === 1 ? "" : "s"} across directions. Scanning for cost overruns and hidden assumptions.`,
    });

    const reflection = reflectionInstructionFor(decisions);
    if (reflection) {
      enterState("reflection");
      const isCostRelated = reflection.includes("HIGH-cost");
      emit({
        type: "thinking",
        message: isCostRelated
          ? "High-cost direction has multiple risks — re-evaluating whether cost assumptions are realistic…"
          : "Re-evaluating approach due to uncertainty…",
      });
      try {
        const refined = await suggestDirectionAction("", context, {
          pastIdeas,
          refinement: reflection,
        });
        throwIfAborted(signal);
        if (refined.length > 0) {
          decisions = applyFeedbackToDecisions(refined, { userAccuracy, calibrationError });
          emit({ type: "decisions", decisions });
        }
      } catch (error) {
        console.warn("[autonomousAgent] reflection pass failed:", error);
      }
    }

    const assumptions = collectAssumptions(decisions);
    if (assumptions.length > 0) {
      emit({ type: "assumptions", assumptions });
    }
    let top = pickTopDecision(decisions);
    if (top) {
      emit({ type: "topDecision", decision: top });
    }
    emit({ type: "checkpoint", message: "Directions scored and validated" });

    // 7. PREDICT_OUTCOME — Stage 5. Mandatory and structured before strategy.
    let predictedOutcome: PredictedOutcome | null = null;
    let patternAccuracy: number | null = null;
    let patternKey = "";
    let predictionPromptRef: PromptRef | undefined;

    if (top) {
      enterState("predict_outcome");
      emit({
        type: "thinking",
        message: "Predicting a measurable outcome — metric, baseline, target, and timeframe.",
      });
      // Forensic snapshot of the exact prompt that produced the prediction.
      const predictionRefRaw = renderPrompt(
        "expected_outcome",
        {
          idea,
          decision: {
            title: top.title,
            summary: top.summary,
            justification: top.justification,
            userStory: top.userStory,
          },
          insights: assumptions,
          strictness,
        },
        { userId: userId ?? null }
      );
      predictionPromptRef = {
        id: predictionRefRaw.promptId,
        version: predictionRefRaw.version,
        hash: predictionRefRaw.hash,
      };
      try {
        predictedOutcome = await predictOutcomeAction(idea, top, assumptions, strictness, userId);
        throwIfAborted(signal);
      } catch (error) {
        console.warn("[autonomousAgent] outcome prediction failed:", error);
      }

      if (predictedOutcome) {
        emit({ type: "expectedOutcome", outcome: predictedOutcome });
        emit({
          type: "checkpoint",
          message: `Outcome predicted: ${predictedOutcome.metric} → ${predictedOutcome.target}${predictedOutcome.unit ?? ""} in ${predictedOutcome.timeframeDays}d`,
        });

        // Pattern-level learning: the predicted metric is now known, so we can
        // bias the top decision's confidence by the user's track record on
        // *this specific metric*. Replace top decision with the adjusted copy.
        patternKey = predictedOutcome.metric.trim();
        const patternKeyNorm = patternKey.toLowerCase();
        if (patternKeyNorm in patternAccuracies) {
          patternAccuracy = patternAccuracies[patternKeyNorm];
          if (typeof top.confidence === "number" && Number.isFinite(top.confidence)) {
            const adjusted = adjustedConfidence(top.confidence, {
              // Pattern-only adjustment here; user/calibration were already applied.
              similarPatternAccuracy: patternAccuracy,
            });
            top = { ...top, confidence: adjusted };
            // Re-emit so the UI updates the top-decision card.
            emit({ type: "topDecision", decision: top });
          }
        }
      } else {
        emit({
          type: "thinking",
          message: "Could not generate a structured prediction. Verdict will lean toward VALIDATE_FIRST.",
        });
      }
    }

    // Emit the explanation row stack now that all feedback factors are known.
    const explanation = buildExplanation({ userAccuracy, calibrationError, patternAccuracy, patternKey });
    if (explanation.length > 0) {
      emit({ type: "confidenceExplanation", items: explanation });
    }

    // 8. CONFIDENCE_GATE — deep mode only
    if (depth === "deep") {
      enterState("confidence_gate");
      const weakHighPri = decisions.find(
        (d) => d.priority === "high" && (d.confidence ?? 10) < 5
      );
      if (weakHighPri) {
        const followUp = await clarifyIdeaAction(
          `${context}\n\nWe're considering: ${weakHighPri.title}. ${weakHighPri.summary ?? weakHighPri.justification}`,
          "Need to validate the strongest direction before strategy.",
          askedQuestions
        );
        throwIfAborted(signal);
        if (followUp) {
          emit({ type: "question", question: followUp });
          enterState("awaiting_user");
          const answer = await awaitUserResponse(followUp);
          throwIfAborted(signal);
          askedQuestions.push(followUp.question);
          context = `${context}\n\nQ: ${followUp.question}\nA: ${answer.trim()}`;
        }
      }
    }

    // 9. STRATEGY_GENERATION
    enterState("strategy_generation");
    emit({ type: "thinking", message: "Defining the strategic theme, gaps to close, and cost constraints." });
    const strategy = await strategicGuidanceAction(context);
    throwIfAborted(signal);
    emit({ type: "strategy", strategy });
    emit({ type: "checkpoint", message: "Strategy defined" });

    // 10. ROADMAP_GENERATION (Standard + Deep only)
    if (depth !== "quick") {
      enterState("roadmap_generation");
      emit({ type: "thinking", message: "Drafting a 3-phase roadmap with budget estimates and validation gates." });
      const roadmap = await generateRoadmapAction(idea, decisions, strategy.theme);
      throwIfAborted(signal);
      emit({ type: "roadmap", roadmap });
      emit({ type: "checkpoint", message: "Roadmap drafted" });
    }

    // 11. VERDICT — multi-factor + prediction guardrail
    emit({
      type: "thinking",
      message: "Computing final verdict using composite score: confidence (40%), cost (30%), demand (20%), strategic fit (10%).",
    });
    const verdict = computeVerdict(decisions, predictedOutcome);
    emit({ type: "verdict", verdict });

    // 12. MEMORY WRITE — persists prediction + accuracy + prompt snapshots.
    if (userId) {
      const memoryRecord: Parameters<typeof savePastRun>[1] = {
        idea,
        topDecisions: decisions.slice(0, 3).map((d) => d.title),
        verdictLabel: verdict.label,
        verdictReason: verdict.reason,
        directionsPromptRef,
      };
      if (predictedOutcome) {
        memoryRecord.predictedOutcome = {
          metric: predictedOutcome.metric,
          baseline: predictedOutcome.baseline,
          target: predictedOutcome.target,
          timeframeDays: predictedOutcome.timeframeDays,
          confidence: predictedOutcome.confidence,
          unit: predictedOutcome.unit,
        };
      }
      if (predictionPromptRef) {
        memoryRecord.predictionPromptRef = predictionPromptRef;
      }
      if (userAccuracy !== null) {
        memoryRecord.userAccuracyAtRun = userAccuracy;
      }
      void savePastRun(userId, memoryRecord);
    }

    // 13. OUTPUT
    enterState("output");
    emit({ type: "done" });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      emit({ type: "state", state: "stopped", label: stateLabels.stopped });
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown agent error";
    emit({ type: "state", state: "error", label: stateLabels.error });
    emit({ type: "error", message });
  }
}
