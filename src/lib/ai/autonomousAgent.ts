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
import {
  renderPrompt,
  computeAndApplyRollbacks,
  hydratePromptOverrides,
  hydrateRollbackOverrides,
} from "./promptLibrary";
import type { PromptRef, PromptId } from "./promptLibrary";
import {
  savePastRun,
  getRecentPastRuns,
  getUserFeedbackSignals,
  getPromptOutcomeMetrics,
  getPromptOverrides,
  setPromptOverride,
  getDecisionModeMeta,
  setDecisionModeMeta,
  recommendDecisionMode,
  shouldSwitchMode,
  computeSwitchReason,
  isSwitchFrozen,
  countRecentSwitches,
  MAX_SWITCHES_IN_WINDOW,
  MAX_SWITCHES_WINDOW_DAYS,
  FREEZE_DURATION_DAYS,
  type SwitchReason,
} from "../firebase/db";

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
  | { type: "expectedOutcome"; outcome: PredictedOutcome; promptRef?: PromptRef }
  | { type: "feedbackApplied"; userAccuracy: number }
  | { type: "confidenceExplanation"; items: ConfidenceExplanationItem[] }
  | { type: "modeAutoSwitched"; from: PredictionStrictness; to: PredictionStrictness; score: number; previousScore: number | null; reason: SwitchReason | null; deltaPct: number | null }
  | { type: "error"; message: string }
  | { type: "done" };

// Pre-computed agent output for resume-from-checkpoint. Any field that is
// present is treated as already done — the agent skips the stage that would
// have produced it and re-emits the stored value before continuing.
export interface AgentResumeData {
  decisions?: DecisionSuggestion[];
  strategy?: StrategicGuidance;
  roadmap?: RoadmapPhase[];
  topDecision?: DecisionSuggestion;
  assumptions?: string[];
  predictedOutcome?: PredictedOutcome;
  verdict?: import("./verdict").Verdict;
}

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
  // v2.8: if true, the agent ignores the user-selected strictness when a
  // hysteresis-passing recommendation exists. Defaults to false.
  autoMode?: boolean;
  // Epoch ms of the last automated mode switch. The view loads this once on
  // mount via getDecisionModeMeta() and passes it through so the agent
  // doesn't add a per-run Firestore read.
  lastSwitchAtMs?: number | null;
  // v3.0 safety: epoch-ms freeze deadline (the agent skips switching while
  // Date.now() < freezeUntil) and the recent switch history used to detect
  // the "more than two switches in 14 days" condition. Both come from the
  // same getDecisionModeMeta() read on mount.
  freezeUntilMs?: number | null;
  switchHistoryMs?: number[];
  // Resume support: pre-computed outputs from a stopped/errored run.
  // Stages whose data is present are replayed immediately rather than re-run.
  resumeData?: AgentResumeData;
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

// Friendly labels for the three switch-reason kinds (v3.0). Used in stream
// messages and the modeAutoSwitched event.
const REASON_LABEL: Record<SwitchReason, string> = {
  accuracy: "higher accuracy",
  hit_rate: "higher hit rate",
  calibration: "better calibration",
};

// v2.7 — deterministic post-prediction math. Conservative mode pulls targets
// down and pushes confidence up; aggressive does the opposite. Balanced is a
// no-op. Targets are clamped to ≥ baseline (when known) so we never invert
// the direction of the bet; confidence stays in [0, 1].
function applyModeAdjustment(
  outcome: PredictedOutcome,
  mode: PredictionStrictness
): PredictedOutcome {
  if (mode === "balanced") return outcome;
  const targetMul = mode === "conservative" ? 0.9 : 1.1;
  const confMul = mode === "conservative" ? 1.1 : 0.9;
  let newTarget = outcome.target * targetMul;
  if (typeof outcome.baseline === "number" && Number.isFinite(outcome.baseline)) {
    newTarget = Math.max(newTarget, outcome.baseline);
  }
  const newConfidence = Math.max(0, Math.min(1, outcome.confidence * confMul));
  return { ...outcome, target: newTarget, confidence: newConfidence };
}

// Apply the deterministic feedback signal to every direction's confidence.
// Pattern factor is intentionally NOT applied here — we don't know the metric
// for each candidate yet, so pattern-level learning is applied only to the
// top decision after prediction.
// v2.6: also accepts the global calibrationBias so over/under-confidence
// gets corrected uniformly across all candidates.
function applyFeedbackToDecisions(
  decisions: DecisionSuggestion[],
  ctx: Pick<AccuracyContext, "userAccuracy" | "calibrationError" | "calibrationBias">
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
  autoMode = false,
  lastSwitchAtMs = null,
  freezeUntilMs = null,
  switchHistoryMs = [],
  resumeData = {},
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
  let calibrationBias: number | null = null;
  let patternAccuracies: Record<string, number> = {};
  let patternBiases: Record<string, number> = {};
  let themeBiases: Record<string, number> = {};

  if (userId) {
    try {
      // v2.5: parallel-fetch all the signals the run depends on, including
      // the authoritative Firestore prompt overrides. One round-trip at
      // startup; subsequent renderPrompt calls read the cache synchronously.
      const [pastRuns, signals, outcomeMetrics, fsOverrides] = await Promise.all([
        getRecentPastRuns(userId, 3),
        getUserFeedbackSignals(userId, 12),
        getPromptOutcomeMetrics(userId, 30),
        getPromptOverrides(userId),
      ]);

      // Populate the version-resolution cache so any renderPrompt(userId, ...)
      // below sees the authoritative override before falling back to local.
      const overrideMap: Partial<Record<PromptId, string>> = {};
      const decisionMap: Record<string, { promptId: PromptId; toVersion: string; fromVersion: string; recentAccuracy: number; previousAccuracy: number; delta: number; recentRuns: number; previousRuns: number; decidedAt: string }> = {};
      for (const [pid, rec] of Object.entries(fsOverrides)) {
        const key = pid as PromptId;
        if (typeof rec.version === "string" && rec.version.length > 0) {
          overrideMap[key] = rec.version;
          if (rec.source === "rollback") {
            const decidedAtIso = rec.decidedAt?.toDate?.()?.toISOString() ?? new Date().toISOString();
            decisionMap[key] = {
              promptId: key,
              toVersion: rec.version,
              fromVersion: rec.fromVersion ?? "",
              recentAccuracy: rec.recentAccuracy ?? 0,
              previousAccuracy: rec.previousAccuracy ?? 0,
              delta: (rec.recentAccuracy ?? 0) - (rec.previousAccuracy ?? 0),
              recentRuns: 0,
              previousRuns: 0,
              decidedAt: decidedAtIso,
            };
          }
        }
      }
      hydratePromptOverrides(userId, overrideMap);
      hydrateRollbackOverrides(overrideMap, decisionMap);

      // Rolling-window rollback compute. Reads samples that were just
      // pulled in parallel — no extra DB call. Returns only NEW decisions,
      // which the agent persists to Firestore so other devices pick them up.
      let newRollbacks: ReturnType<typeof computeAndApplyRollbacks> = [];
      try {
        newRollbacks = computeAndApplyRollbacks(outcomeMetrics.samplesByPromptId);
      } catch (err) {
        console.warn("[autonomousAgent] rollback compute failed:", err);
      }
      // Fire-and-forget Firestore writes for any new rollback decisions —
      // never block the run on this; if the network's flaky we still run
      // with the in-memory + localStorage override and converge later.
      for (const d of newRollbacks) {
        void setPromptOverride(userId, d.promptId, {
          version: d.toVersion,
          source: "rollback",
          fromVersion: d.fromVersion,
          recentAccuracy: d.recentAccuracy,
          previousAccuracy: d.previousAccuracy,
        });
      }

      // v2.8 + v3.0: auto-mode resolution with safety guards.
      //   1. Compute recommendation from modeBreakdown (deterministic).
      //   2. Apply hysteresis (≥0.03 score gap, ≥7d cooldown).
      //   3. Apply v3.0 safety: respect freezeUntil; if too many recent
      //      switches, freeze instead of switching.
      //   4. On switch, compute reason + delta for explainability.
      // No extra Firestore reads — freezeUntil and switchHistory ride along
      // with the lastSwitchAt that the view loaded on mount.
      if (autoMode) {
        const recommendation = recommendDecisionMode(outcomeMetrics.modeBreakdown);
        const lastSwitchDate = lastSwitchAtMs ? new Date(lastSwitchAtMs) : null;
        const freezeUntilDate = freezeUntilMs ? new Date(freezeUntilMs) : null;
        const switchHistory = (switchHistoryMs ?? []).map((ms) => new Date(ms));

        const hysteresisOk = shouldSwitchMode(strictness, recommendation, lastSwitchDate);
        const frozen = isSwitchFrozen(freezeUntilDate);
        const recentSwitchCount = countRecentSwitches(switchHistory);
        // Counting THIS upcoming switch — if past+current would exceed the
        // limit, we freeze instead of letting it through.
        const wouldExceedLimit = hysteresisOk && (recentSwitchCount + 1) > MAX_SWITCHES_IN_WINDOW;

        const switchOk = hysteresisOk && !frozen && !wouldExceedLimit;

        // Compute reason ahead of the switch so we can both log it and
        // persist it on the meta doc.
        const reasonInfo = switchOk
          ? computeSwitchReason(strictness, recommendation.recommendedMode, outcomeMetrics.modeBreakdown)
          : null;
        const previousScoreForRecord = recommendation.scoresPerMode[strictness] ?? null;
        const compositeDelta = previousScoreForRecord !== null
          ? recommendation.score - previousScoreForRecord
          : null;

        // If the rate-limit was the blocker, set a freeze window and emit a
        // stream message so the user knows the system is intentionally
        // sitting still rather than ignoring data.
        let nextFreezeUntil: Date | null = freezeUntilDate ?? null;
        if (wouldExceedLimit && !frozen) {
          nextFreezeUntil = new Date(Date.now() + FREEZE_DURATION_DAYS * 24 * 60 * 60 * 1000);
          emit({
            type: "thinking",
            message: `Mode frozen: ${recentSwitchCount} switches in the last ${MAX_SWITCHES_WINDOW_DAYS} days. Holding ${strictness} for ~${FREEZE_DURATION_DAYS}d to avoid thrash.`,
          });
        } else if (frozen) {
          emit({
            type: "thinking",
            message: `Auto-mode frozen until ${freezeUntilDate?.toLocaleDateString?.() ?? "next window"} — keeping ${strictness}.`,
          });
        }

        // History maintenance: append the new switch timestamp and keep at
        // most a small ring buffer so the doc stays small.
        const updatedHistoryDates = switchOk
          ? [...switchHistory, new Date()].slice(-10)
          : switchHistory;

        // Persist meta. Three cases share the same write:
        //   - successful switch (markSwitched=true, reason populated)
        //   - frozen / rate-limited (markSwitched=false, but freezeUntil updated)
        //   - no-op evaluation (markSwitched=false, refresh score snapshot only)
        void setDecisionModeMeta(userId, {
          recommendedMode: recommendation.recommendedMode,
          score: recommendation.score,
          markSwitched: switchOk,
          previousMode: switchOk ? strictness : null,
          previousScore: switchOk ? previousScoreForRecord : null,
          delta: switchOk ? compositeDelta : null,
          reason: reasonInfo?.reason ?? null,
          freezeUntil: nextFreezeUntil,
          switchHistoryDates: switchOk ? updatedHistoryDates : null,
        });

        if (switchOk) {
          emit({
            type: "modeAutoSwitched",
            from: strictness,
            to: recommendation.recommendedMode,
            score: recommendation.score,
            previousScore: previousScoreForRecord,
            reason: reasonInfo?.reason ?? null,
            deltaPct: reasonInfo?.deltaPct ?? null,
          });
          const reasonText = reasonInfo
            ? `${REASON_LABEL[reasonInfo.reason]} +${reasonInfo.deltaPct}%`
            : `composite +${compositeDelta !== null ? (compositeDelta * 100).toFixed(1) : "—"}%`;
          emit({
            type: "thinking",
            message: `Auto mode: ${strictness} → ${recommendation.recommendedMode} (${reasonText}).`,
          });
          strictness = recommendation.recommendedMode;
        }
      }
      pastIdeas = pastRuns.map((run) => run.idea).filter((s) => s.length > 0);
      userAccuracy = signals.userAccuracy;
      calibrationError = signals.calibrationError;
      calibrationBias = signals.calibrationBias;
      patternAccuracies = signals.patternAccuracies;
      patternBiases = signals.patternBiases;
      themeBiases = signals.themeBiases;

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
      if (calibrationBias !== null && Math.abs(calibrationBias) >= 0.05) {
        const direction = calibrationBias > 0 ? "overconfident" : "underconfident";
        const biasPct = Math.round(Math.abs(calibrationBias) * 100);
        emit({
          type: "thinking",
          message: `Calibration bias: ${direction} by ${biasPct}%. Confidence ${calibrationBias > 0 ? "reduced 10%" : "boosted 10%"} to compensate.`,
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

    // 4. GENERATE_DECISIONS — skip if resume data already has them
    let directionsPromptRef: PromptRef = { id: "suggest_direction", version: "resumed", hash: "" };
    let decisions: DecisionSuggestion[];

    if (resumeData.decisions && resumeData.decisions.length > 0) {
      decisions = resumeData.decisions;
      emit({ type: "thinking", message: "Resuming — replaying previous decisions from checkpoint." });
      emit({ type: "decisions", decisions });
    } else {
      enterState("generate_decisions");
      emit({
        type: "thinking",
        message: "Drafting 3 candidate directions — each with assumptions, risks, and a production cost model.",
      });
      const directionsRefRaw = renderPrompt(
        "suggest_direction",
        { pastIdeas, refinement: undefined },
        { userId: userId ?? null }
      );
      directionsPromptRef = {
        id: directionsRefRaw.promptId,
        version: directionsRefRaw.version,
        hash: directionsRefRaw.hash,
      };
      decisions = await suggestDirectionAction(userId ?? "", context, {
        pastIdeas,
        calibrationBias,
      });
      throwIfAborted(signal);
      decisions = applyFeedbackToDecisions(decisions, { userAccuracy, calibrationError, calibrationBias });
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
            calibrationBias,
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
      emit({ type: "checkpoint", message: "Directions scored and validated" });
    }

    const assumptions = resumeData.assumptions ?? collectAssumptions(decisions);
    if (assumptions.length > 0) {
      emit({ type: "assumptions", assumptions });
    }
    let top = resumeData.topDecision ?? pickTopDecision(decisions);
    if (top) {
      emit({ type: "topDecision", decision: top });
    }

    // 7. PREDICT_OUTCOME — Stage 5. Mandatory and structured before strategy.
    let predictedOutcome: PredictedOutcome | null = resumeData.predictedOutcome ?? null;
    let patternAccuracy: number | null = null;
    let patternKey = "";
    let predictionPromptRef: PromptRef | undefined;

    if (predictedOutcome) {
      emit({ type: "expectedOutcome", outcome: predictedOutcome });
      emit({ type: "thinking", message: "Resuming — replaying previous outcome prediction." });
    } else if (top) {
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
        predictedOutcome = await predictOutcomeAction(idea, top, assumptions, strictness, userId, calibrationBias);
        throwIfAborted(signal);
      } catch (error) {
        console.warn("[autonomousAgent] outcome prediction failed:", error);
      }

      // v2.7: deterministic mode adjustment on top of the LLM-shaped prompt.
      // The prompt already steers toward the chosen strictness, but the LLM's
      // numbers can drift. This re-pins targets and confidence to the spec'd
      // multipliers and emits a stream message so the user sees the change.
      if (predictedOutcome && strictness !== "balanced") {
        const before = predictedOutcome;
        const adjusted = applyModeAdjustment(before, strictness);
        if (adjusted.target !== before.target || adjusted.confidence !== before.confidence) {
          predictedOutcome = adjusted;
          const direction = strictness === "conservative" ? "safer targets, higher confidence" : "stretch targets, lower confidence";
          emit({
            type: "thinking",
            message: `Decision mode: ${strictness} — ${direction} (target ${before.target} → ${adjusted.target}, confidence ${(before.confidence * 100).toFixed(0)}% → ${(adjusted.confidence * 100).toFixed(0)}%).`,
          });
        }
      }

      if (predictedOutcome) {
        emit({ type: "expectedOutcome", outcome: predictedOutcome, promptRef: predictionPromptRef });
        emit({
          type: "checkpoint",
          message: `Outcome predicted: ${predictedOutcome.metric} → ${predictedOutcome.target}${predictedOutcome.unit ?? ""} in ${predictedOutcome.timeframeDays}d`,
        });

        // Pattern-level learning: the predicted metric is now known, so we can
        // bias the top decision's confidence by the user's track record on
        // *this specific metric*. Replace top decision with the adjusted copy.
        // v2.6: also fold in pattern-level calibration bias so the per-pattern
        // over/under-confidence signal pulls the score toward reality. Theme
        // bias isn't applied here because the strategy step (which knows the
        // theme) hasn't run yet — the global calibrationBias on the broader
        // applyFeedbackToDecisions pass already covers that surface.
        patternKey = predictedOutcome.metric.trim();
        const patternKeyNorm = patternKey.toLowerCase();

        const matchedPatternAccuracy = patternKeyNorm in patternAccuracies ? patternAccuracies[patternKeyNorm] : null;
        const matchedPatternBias = patternKeyNorm in patternBiases ? patternBiases[patternKeyNorm] : null;

        if (matchedPatternAccuracy !== null) {
          patternAccuracy = matchedPatternAccuracy;
        }

        if ((matchedPatternAccuracy !== null || matchedPatternBias !== null) &&
            typeof top.confidence === "number" && Number.isFinite(top.confidence)) {
          const adjusted = adjustedConfidence(top.confidence, {
            // Pattern-only adjustment here; user/calibration were already applied.
            similarPatternAccuracy: matchedPatternAccuracy,
            similarPatternBias: matchedPatternBias,
          });
          top = { ...top, confidence: adjusted };
          // Re-emit so the UI updates the top-decision card.
          emit({ type: "topDecision", decision: top });
        }
      } else {
        emit({
          type: "thinking",
          message: "Could not generate a structured prediction. Verdict will lean toward VALIDATE_FIRST.",
        });
      }
    } // end predict_outcome block

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
    let strategy: StrategicGuidance;
    if (resumeData.strategy) {
      strategy = resumeData.strategy;
      emit({ type: "thinking", message: "Resuming — replaying previous strategy." });
      emit({ type: "strategy", strategy });
    } else {
      enterState("strategy_generation");
      emit({ type: "thinking", message: "Defining the strategic theme, gaps to close, and cost constraints." });
      strategy = await strategicGuidanceAction(context);
      throwIfAborted(signal);
      emit({ type: "strategy", strategy });
      emit({ type: "checkpoint", message: "Strategy defined" });
    }

    // 10. ROADMAP_GENERATION (Standard + Deep only)
    if (depth !== "quick") {
      if (resumeData.roadmap && resumeData.roadmap.length > 0) {
        emit({ type: "thinking", message: "Resuming — replaying previous roadmap." });
        emit({ type: "roadmap", roadmap: resumeData.roadmap });
      } else {
        enterState("roadmap_generation");
        emit({ type: "thinking", message: "Drafting a 3-phase roadmap with budget estimates and validation gates." });
        const roadmap = await generateRoadmapAction(idea, decisions, strategy.theme);
        throwIfAborted(signal);
        emit({ type: "roadmap", roadmap });
        emit({ type: "checkpoint", message: "Roadmap drafted" });
      }
    }

    // 11. VERDICT — multi-factor + prediction guardrail
    let verdict: import("./verdict").Verdict;
    if (resumeData.verdict) {
      verdict = resumeData.verdict;
      emit({ type: "thinking", message: "Resuming — replaying previous verdict." });
    } else {
      emit({
        type: "thinking",
        message: "Computing final verdict using composite score: confidence (40%), cost (30%), demand (20%), strategic fit (10%).",
      });
      verdict = computeVerdict(decisions, predictedOutcome);
    }
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
