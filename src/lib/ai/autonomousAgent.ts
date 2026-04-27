// Frontend-orchestrated autonomous-mode agent.
//
// Runs the v1.1 state machine: refines an idea, gathers clarifications,
// generates + reflects on decisions, validates, lands on a verdict, and
// stores the run for future memory injection.

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
  // Optional Firebase user id. When present the agent loads recent past runs
  // and persists this run for future memory. Anonymous runs skip both.
  userId?: string;
}

const stateLabels: Record<AgentState, string> = {
  idle: "Idle",
  understand_idea: "Identifying target users and core problem…",
  check_clarity: "Checking what's missing…",
  awaiting_user: "Needs clarification",
  generate_decisions: "Generating product decisions and tradeoffs…",
  reflection: "Re-evaluating approach due to uncertainty…",
  evaluate_decisions: "Scoring feasibility vs impact…",
  validation_layer: "Detecting risky assumptions and weak signals…",
  confidence_gate: "Validating the strongest direction…",
  strategy_generation: "Defining strategic focus…",
  roadmap_generation: "Drafting a 3-phase roadmap…",
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

  // Memory retrieval — non-blocking. If Firestore is offline or perms fail
  // we proceed without past context rather than blocking the whole run.
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

    // 2. CHECK_CLARITY
    for (let round = 0; round < maxClarifications; round++) {
      enterState("check_clarity");
      const question = await clarifyIdeaAction(context, "", askedQuestions);
      throwIfAborted(signal);

      if (!question) {
        emit({ type: "thinking", message: "No critical gaps. Moving to decisions." });
        break;
      }

      emit({ type: "question", question });
      enterState("awaiting_user");
      const answer = await awaitUserResponse(question);
      throwIfAborted(signal);

      askedQuestions.push(question.question);
      context = `${context}\n\nQ: ${question.question}\nA: ${answer.trim()}`;
    }

    // 3. GENERATE_DECISIONS
    enterState("generate_decisions");
    emit({
      type: "thinking",
      message: "Drafting 3 candidate directions, each with assumptions, risks, and a contrarian insight.",
    });
    let decisions = await suggestDirectionAction("", context, { pastIdeas });
    throwIfAborted(signal);
    emit({ type: "decisions", decisions });

    // 4. EVALUATE_DECISIONS
    enterState("evaluate_decisions");
    emit({
      type: "thinking",
      message: `Scored ${decisions.length} candidates on impact, effort, confidence, and demand.`,
    });

    // 5. VALIDATION_LAYER + REFLECTION
    enterState("validation_layer");
    const totalRisks = decisions.reduce((sum, d) => sum + (d.risks?.length ?? 0), 0);
    emit({
      type: "thinking",
      message: `Detected ${totalRisks} risk${totalRisks === 1 ? "" : "s"} across the directions. Looking for hidden assumptions.`,
    });

    const reflection = reflectionInstructionFor(decisions);
    if (reflection) {
      enterState("reflection");
      emit({ type: "thinking", message: "Re-evaluating approach due to uncertainty…" });
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
        // Reflection is a quality booster, not a blocker. Carry on with the
        // first-pass decisions if the second pass fails.
        console.warn("[autonomousAgent] reflection pass failed:", error);
      }
    }

    // Surface assumptions and the top decision regardless of reflection.
    const assumptions = collectAssumptions(decisions);
    if (assumptions.length > 0) {
      emit({ type: "assumptions", assumptions });
    }
    const top = pickTopDecision(decisions);
    if (top) {
      emit({ type: "topDecision", decision: top });
    }

    // 6. CONFIDENCE_GATE — deep depth only
    if (depth === "deep") {
      enterState("confidence_gate");
      const weakHighPri = decisions.find(
        (d) => d.priority === "high" && (d.confidence ?? 10) < 5
      );
      if (weakHighPri) {
        const followUp = await clarifyIdeaAction(
          `${context}\n\nWe're considering: ${weakHighPri.title}. ${weakHighPri.summary ?? weakHighPri.justification}`,
          "Need to validate the strongest decision before strategy.",
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

    // 7. STRATEGY_GENERATION
    enterState("strategy_generation");
    emit({ type: "thinking", message: "Defining the strategic theme and the gaps that block confidence." });
    const strategy = await strategicGuidanceAction(context);
    throwIfAborted(signal);
    emit({ type: "strategy", strategy });

    // 8. ROADMAP_GENERATION
    if (depth !== "quick") {
      enterState("roadmap_generation");
      emit({ type: "thinking", message: "Drafting a 3-phase roadmap. Phase 1 will test the riskiest assumption first." });
      const roadmap = await generateRoadmapAction(idea, decisions, strategy.theme);
      throwIfAborted(signal);
      emit({ type: "roadmap", roadmap });
    }

    // 9. VERDICT — opinionated landing.
    const verdict = computeVerdict(decisions);
    emit({ type: "verdict", verdict });

    // 10. MEMORY WRITE — fire-and-forget. Failure here must not affect the
    //     user-facing run.
    if (userId) {
      void savePastRun(userId, {
        idea,
        topDecisions: decisions.slice(0, 3).map((d) => d.title),
        verdictLabel: verdict.label,
        verdictReason: verdict.reason,
      });
    }

    // 11. OUTPUT
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
