// Frontend-orchestrated autonomous-mode agent.
//
// Runs the state machine described in the v1.0 spec by calling existing AI
// actions in sequence and emitting events the UI subscribes to. This lives on
// the client (not the backend) because:
// 1. It reuses the same AI action functions the rest of the app uses, so the
//    behavior stays consistent.
// 2. Streaming updates to the UI is trivial without setting up SSE.
// 3. Aborts are AbortSignal-based, no server state to clean up.
//
// Trade-off: the run dies if the user closes the tab. For an MVP that is fine.

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

export type AgentState =
  | "idle"
  | "understand_idea"
  | "check_clarity"
  | "awaiting_user"
  | "generate_decisions"
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
  | { type: "error"; message: string }
  | { type: "done" };

export interface AgentRunOptions {
  idea: string;
  depth: AgentDepth;
  signal: AbortSignal;
  emit: (event: AgentEvent) => void;
  // Resolves when the user has answered an outstanding clarifying question, or
  // rejects with AbortError if the user stopped the run instead.
  awaitUserResponse: (question: ClarifyingQuestion) => Promise<string>;
  alreadyAsked: string[];
}

const stateLabels: Record<AgentState, string> = {
  idle: "Idle",
  understand_idea: "Analyzing idea…",
  check_clarity: "Checking clarity…",
  awaiting_user: "Needs clarification…",
  generate_decisions: "Generating decisions…",
  evaluate_decisions: "Evaluating decisions…",
  validation_layer: "Validating assumptions…",
  confidence_gate: "Checking confidence…",
  strategy_generation: "Defining strategy…",
  roadmap_generation: "Drafting roadmap…",
  output: "Finalizing output…",
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
}: AgentRunOptions): Promise<void> {
  const enterState = (state: AgentState) => {
    throwIfAborted(signal);
    emit({ type: "state", state, label: stateLabels[state] });
  };

  // Track context across stages so clarification questions can build on it.
  let context = idea.trim();
  // The clarification stage may add answers; concatenate so subsequent calls
  // see the full picture.
  const askedQuestions = [...alreadyAsked];

  // Quick depth caps the clarification rounds at 0; standard/deep allow up to 2.
  const maxClarifications = depth === "quick" ? 0 : depth === "standard" ? 1 : 2;

  try {
    // 1. UNDERSTAND_IDEA — light pass; we don't have a separate "refine" action,
    //    so this state is mostly a label for the UI. The downstream prompts do
    //    the actual refinement.
    enterState("understand_idea");
    emit({ type: "thinking", message: "Reading the raw idea and pulling out the implied user, problem, and outcome." });

    // 2. CHECK_CLARITY — loop up to maxClarifications times.
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
    emit({ type: "thinking", message: "Drafting 3 candidate directions and weighing them against the context." });
    const decisions = await suggestDirectionAction("", context);
    throwIfAborted(signal);
    emit({ type: "decisions", decisions });

    // 4. EVALUATE_DECISIONS — the impact/effort/priority scores already come from
    //    the structured prompt in suggestDirectionAction. We surface the state
    //    without an extra round-trip.
    enterState("evaluate_decisions");
    emit({
      type: "thinking",
      message: `Scored ${decisions.length} decisions on impact, effort, confidence, and demand.`,
    });

    // 5. VALIDATION_LAYER — risks and key insights are already in the structured
    //    output. Surface a thinking event listing the top risks.
    enterState("validation_layer");
    const riskyCount = decisions.filter((d) => d.priority === "high" && d.impact >= 7).length;
    emit({
      type: "thinking",
      message: riskyCount > 0
        ? `${riskyCount} high-priority direction${riskyCount === 1 ? "" : "s"} identified — checking for overcommit risk.`
        : "Risks extracted from structured output. No high-stakes overcommit detected.",
    });

    // 6. CONFIDENCE_GATE — if depth is deep AND any high-priority decision has
    //    weak supporting evidence in the context, ask one targeted follow-up.
    if (depth === "deep") {
      enterState("confidence_gate");
      const weakHighPri = decisions.find((d) => d.priority === "high" && (!d.risks || d.risks.length < 2));
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
    emit({ type: "thinking", message: "Defining the strategic theme and missing-evidence gaps." });
    const strategy = await strategicGuidanceAction(context);
    throwIfAborted(signal);
    emit({ type: "strategy", strategy });

    // 8. ROADMAP_GENERATION — quick depth skips the roadmap to ship faster.
    if (depth !== "quick") {
      enterState("roadmap_generation");
      emit({ type: "thinking", message: "Drafting a 3-phase roadmap that validates the riskiest assumption first." });
      const roadmap = await generateRoadmapAction(idea, decisions, strategy.theme);
      throwIfAborted(signal);
      emit({ type: "roadmap", roadmap });
    }

    // 9. OUTPUT
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
