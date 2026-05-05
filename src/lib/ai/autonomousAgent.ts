// Frontend-orchestrated autonomous-mode agent (v2.0).
//
// Runs a 13-step state machine: refines an idea, gathers clarifications,
// generates candidate directions with cost models, reflects, validates, lands
// on a multi-factor verdict, and stores the run for future memory injection.

import {
  suggestDirectionAction,
  strategicGuidanceAction,
  clarifyIdeaAction,
  generateRoadmapAction,
  type DecisionSuggestion,
  type StrategicGuidance,
  type RoadmapPhase,
  type ClarifyingQuestion,
} from "./actions";
import {
  computeVerdict,
  pickTopDecision,
  collectAssumptions,
  reflectionInstructionFor,
  type Verdict,
} from "./verdict";
import { savePastRun, getRecentPastRuns } from "../firebase/db";

export type AgentState =
  | "idle"
  | "understand_idea"
  | "check_clarity"
  | "awaiting_user"
  | "generate_decisions"
  | "reflection"
  | "evaluate_decisions"
  | "validation_layer"
  | "confidence_gate"
  | "strategy_generation"
  | "roadmap_generation"
  | "output"
  | "stopped"
  | "error";

export type AgentDepth = "quick" | "standard" | "deep";

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

export async function runAutonomousAgent({
  idea,
  depth,
  signal,
  emit,
  awaitUserResponse,
  alreadyAsked,
  userId,
}: AgentRunOptions): Promise<void> {
  const enterState = (state: AgentState) => {
    throwIfAborted(signal);
    emit({ type: "state", state, label: stateLabels[state] });
  };

  let context = idea.trim();
  const askedQuestions = [...alreadyAsked];
  const maxClarifications = depth === "quick" ? 0 : depth === "standard" ? 1 : 2;

  // Memory retrieval — non-blocking. Failure here must not block the run.
  let pastIdeas: string[] = [];
  if (userId) {
    try {
      const pastRuns = await getRecentPastRuns(userId, 3);
      pastIdeas = pastRuns.map((run) => run.idea).filter((s) => s.length > 0);
      if (pastIdeas.length > 0) {
        emit({ type: "memoryLoaded", pastIdeas });
        emit({
          type: "thinking",
          message: `Pulled ${pastIdeas.length} recent run${pastIdeas.length === 1 ? "" : "s"} from memory — will avoid repeating weak framings.`,
        });
      }
    } catch (error) {
      console.warn("[autonomousAgent] memory load failed:", error);
    }
  }

  try {
    // 1. UNDERSTAND_IDEA
    enterState("understand_idea");
    emit({
      type: "thinking",
      message: "Reading the raw idea. Pulling out the implied user, the friction, and the metric that would prove it works.",
    });

    // 2–3. CHECK_CLARITY + AWAIT_USER (repeated up to maxClarifications times)
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

    // 4. GENERATE_DECISIONS (with cost models)
    enterState("generate_decisions");
    emit({
      type: "thinking",
      message: "Drafting 3 candidate directions — each with assumptions, risks, and a production cost model.",
    });
    let decisions = await suggestDirectionAction("", context, { pastIdeas });
    throwIfAborted(signal);
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
      const isCosteRelated = reflection.includes("HIGH-cost");
      emit({
        type: "thinking",
        message: isCosteRelated
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
          decisions = refined;
          emit({ type: "decisions", decisions });
        }
      } catch (error) {
        // Reflection is a quality booster, not a blocker.
        console.warn("[autonomousAgent] reflection pass failed:", error);
      }
    }

    // Surface assumptions and top decision regardless of reflection outcome.
    const assumptions = collectAssumptions(decisions);
    if (assumptions.length > 0) {
      emit({ type: "assumptions", assumptions });
    }
    const top = pickTopDecision(decisions);
    if (top) {
      emit({ type: "topDecision", decision: top });
    }
    emit({ type: "checkpoint", message: "Directions scored and validated" });

    // 7. CONFIDENCE_GATE — deep mode only
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

    // 8. STRATEGY_GENERATION
    enterState("strategy_generation");
    emit({ type: "thinking", message: "Defining the strategic theme, gaps to close, and cost constraints." });
    const strategy = await strategicGuidanceAction(context);
    throwIfAborted(signal);
    emit({ type: "strategy", strategy });
    emit({ type: "checkpoint", message: "Strategy defined" });

    // 9. ROADMAP_GENERATION (Standard + Deep only)
    if (depth !== "quick") {
      enterState("roadmap_generation");
      emit({ type: "thinking", message: "Drafting a 3-phase roadmap with budget estimates and validation gates." });
      const roadmap = await generateRoadmapAction(idea, decisions, strategy.theme);
      throwIfAborted(signal);
      emit({ type: "roadmap", roadmap });
      emit({ type: "checkpoint", message: "Roadmap drafted" });
    }

    // 10. VERDICT — multi-factor composite score
    emit({ type: "thinking", message: "Computing final verdict using composite score: confidence (40%), cost (30%), demand (20%), strategic fit (10%)." });
    const verdict = computeVerdict(decisions);
    emit({ type: "verdict", verdict });

    // 11. MEMORY WRITE — fire-and-forget. Failure must not affect the user-facing run.
    if (userId) {
      void savePastRun(userId, {
        idea,
        topDecisions: decisions.slice(0, 3).map((d) => d.title),
        verdictLabel: verdict.label,
        verdictReason: verdict.reason,
      });
    }

    // 12. OUTPUT
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
