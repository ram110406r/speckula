"use client";

import React from "react";
import {
  Bot, Send, Loader2, Sparkles, StopCircle, Zap, Brain,
  Target, AlertTriangle, CheckCircle2, Lightbulb, Map,
  Compass, Flame, ShieldAlert, ShieldCheck, ShieldX,
  RotateCcw, FileText, ListTodo, Save, Cpu, HelpCircle,
  DollarSign, MapPin, Gauge, TrendingUp, TrendingDown, Activity,
  Shield, Crosshair, Rocket, Info,
  Clock, Download, Share2, Copy, Check, X, RefreshCw, History,
  ChevronDown, Table2, LayoutList, MessageSquare, Users, Pencil,
  ChevronRight, ChevronUp, BookOpen, PlayCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  runAutonomousAgent,
  type AgentEvent,
  type AgentDepth,
  type AgentState,
  type ConfidenceExplanationItem,
} from "@/lib/ai/autonomousAgent";
import { getRollbackDecisions, type RollbackDecision } from "@/lib/ai/promptLibrary";
import type {
  DecisionSuggestion,
  StrategicGuidance,
  RoadmapPhase,
  ClarifyingQuestion,
  CostCategory,
  PredictedOutcome,
  PredictionStrictness,
} from "@/lib/ai/actions";
import type { Verdict, VerdictLabel, VerdictFactors } from "@/lib/ai/verdict";
import {
  saveDecision,
  getDecisionModeSettings,
  setDecisionModeSettings,
  getDecisionModeMeta,
  getRecentPastRuns,
  publishCase,
  createDocument,
  saveDocument,
  type DecisionMode,
  type DecisionModeMeta,
  type PastRunRecord,
} from "@/lib/firebase/db";
import {
  generatePRDAction,
  suggestTasksAction,
  textToTipTap,
  generateCompetitorAnalysis,
  queryAboutRun,
  type CompetitorSignal,
} from "@/lib/ai/actions";
import type { AgentResumeData } from "@/lib/ai/autonomousAgent";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToastStore";
import { activity } from "@/store/useActivityStore";

// ── Types ─────────────────────────────────────────────────────────────────────

type ChatEntryInput =
  | { kind: "user"; text: string }
  | { kind: "thinking"; text: string; state?: AgentState }
  | { kind: "question"; question: ClarifyingQuestion }
  | { kind: "system"; text: string }
  | { kind: "checkpoint"; text: string }
  | { kind: "error"; text: string };

type ChatEntry = ChatEntryInput & { id: string };

const depthOptions: ReadonlyArray<{
  id: AgentDepth;
  label: string;
  description: string;
  hint: string;
  icon: React.ElementType;
}> = [
  { id: "quick",    label: "Quick",    description: "Fast. No clarifications.",       hint: "Skip clarifications + roadmap",   icon: Zap   },
  { id: "standard", label: "Standard", description: "Balanced. One clarification.",   hint: "1 clarification, full output",    icon: Brain },
  { id: "deep",     label: "Deep",     description: "Thorough. Confidence gate.",     hint: "2 clarifications, confidence gate", icon: Cpu   },
];

const STEPPER_STEPS: { label: string; sublabel: string; states: AgentState[] }[] = [
  { label: "Understanding",      sublabel: "Idea & problem space",     states: ["understand_idea", "check_clarity", "awaiting_user"] },
  { label: "Gathering signals",  sublabel: "Decisions & tradeoffs",    states: ["generate_decisions", "reflection"] },
  { label: "Building argument",  sublabel: "Scoring & validation",     states: ["evaluate_decisions", "validation_layer", "predict_outcome", "confidence_gate"] },
  { label: "Generating verdict", sublabel: "Strategy, roadmap, ship",  states: ["strategy_generation", "roadmap_generation", "output"] },
];

let entryCounter = 0;
const nextEntryId = () => `entry-${++entryCounter}`;

function getActiveStep(state: AgentState): number {
  if (state === "output") return STEPPER_STEPS.length;
  for (let i = 0; i < STEPPER_STEPS.length; i++) {
    if ((STEPPER_STEPS[i].states as AgentState[]).includes(state)) return i;
  }
  return -1;
}

// ── Main component ────────────────────────────────────────────────────────────

export function AutonomousModeView() {
  const { user } = useAuth();
  const { setActiveView, currentDocId, documents, setPendingImport, markDocumentAsNew, setCurrentDocId, setDocuments } = useAppStore();
  const [idea, setIdea] = React.useState("");
  const [depth, setDepth] = React.useState<AgentDepth>(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("speckula-am-depth");
      if (saved === "quick" || saved === "standard" || saved === "deep") return saved;
    }
    return "standard";
  });
  const [chat, setChat] = React.useState<ChatEntry[]>([]);
  const [agentState, setAgentState] = React.useState<AgentState>("idle");
  const [decisions, setDecisions] = React.useState<DecisionSuggestion[]>([]);
  const [strategy, setStrategy] = React.useState<StrategicGuidance | null>(null);
  const [roadmap, setRoadmap] = React.useState<RoadmapPhase[]>([]);
  const [topDecision, setTopDecision] = React.useState<DecisionSuggestion | null>(null);
  const [assumptions, setAssumptions] = React.useState<string[]>([]);
  const [verdict, setVerdict] = React.useState<Verdict | null>(null);
  const [predictedOutcome, setPredictedOutcome] = React.useState<PredictedOutcome | null>(null);
  const [predictionPromptRef, setPredictionPromptRef] = React.useState<{ id: string; version: string; hash: string } | null>(null);
  const [userAccuracy, setUserAccuracy] = React.useState<number | null>(null);
  const [confidenceExplanation, setConfidenceExplanation] = React.useState<ConfidenceExplanationItem[]>([]);
  const [strictness, setStrictness] = React.useState<PredictionStrictness>("balanced");
  const [autoMode, setAutoModeState] = React.useState<boolean>(false);
  const [modeMeta, setModeMeta] = React.useState<DecisionModeMeta | null>(null);
  const [rollbacks, setRollbacks] = React.useState<RollbackDecision[]>([]);
  const [pastIdeas, setPastIdeas] = React.useState<string[]>([]);
  const [pendingQuestion, setPendingQuestion] = React.useState<ClarifyingQuestion | null>(null);
  const [answerText, setAnswerText] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [isConvertingToSpec, setIsConvertingToSpec] = React.useState(false);
  const [isCreatingTasks, setIsCreatingTasks] = React.useState(false);
  const [mobileTab, setMobileTab] = React.useState<"input" | "stream" | "output">(() => {
    if (typeof sessionStorage !== "undefined") {
      const saved = sessionStorage.getItem("speckula-am-tab");
      if (saved === "input" || saved === "stream" || saved === "output") return saved;
    }
    return "input";
  });

  // item 16: elapsed timer
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const elapsedTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // item 18: stream filter
  const [showThinking, setShowThinking] = React.useState(true);

  // item 8: output view mode
  const [outputView, setOutputView] = React.useState<"cards" | "table">("cards");

  // output tab navigation
  const [outputTab, setOutputTab] = React.useState<"overview" | "decisions" | "strategy" | "roadmap">("overview");

  // item 7: expanded decision card indices
  const [expandedDecisions, setExpandedDecisions] = React.useState<Set<number>>(new Set());

  // item 13: recent ideas history
  const [recentIdeas, setRecentIdeas] = React.useState<PastRunRecord[]>([]);
  const [showHistory, setShowHistory] = React.useState(false);

  // item 22: publish case
  const [savedDecisionId, setSavedDecisionId] = React.useState<string | null>(null);
  const [isPublishing, setIsPublishing] = React.useState(false);

  // item 4: save all decisions
  const [isSavingAll, setIsSavingAll] = React.useState(false);

  // item 23: send to editor
  const [isSendingToEditor, setIsSendingToEditor] = React.useState(false);

  // item 3: follow-up Q&A
  const [followUpText, setFollowUpText] = React.useState("");
  const [followUpAnswer, setFollowUpAnswer] = React.useState<string | null>(null);
  const [isFollowingUp, setIsFollowingUp] = React.useState(false);
  const followUpAbortRef = React.useRef<AbortController | null>(null);

  // item 11: competitor signals
  const [competitors, setCompetitors] = React.useState<CompetitorSignal[]>([]);
  const [isLoadingCompetitors, setIsLoadingCompetitors] = React.useState(false);

  // item 5: what-if flipped assumptions
  const [flippedAssumptions, setFlippedAssumptions] = React.useState<Set<number>>(new Set());

  // item 10: roadmap editing
  const [editingPhase, setEditingPhase] = React.useState<number | null>(null);
  const [editingRoadmap, setEditingRoadmap] = React.useState<typeof roadmap>([]);

  // item 9: accuracy history (for sparkline)
  const [accuracyHistory, setAccuracyHistory] = React.useState<number[]>([]);

  // item 1: resume data from last stopped/errored run
  const resumeDataRef = React.useRef<AgentResumeData>({});

  // item 14: depth — persisted to localStorage
  const isRunning = agentState !== "idle" && agentState !== "stopped" && agentState !== "error" && agentState !== "output";
  const isDone = agentState === "output";

  const abortRef = React.useRef<AbortController | null>(null);
  const answerResolverRef = React.useRef<((value: string) => void) | null>(null);
  const answerRejecterRef = React.useRef<((reason: Error) => void) | null>(null);
  const chatScrollRef = React.useRef<HTMLDivElement>(null);
  // Tracks which document was active when the current run started so that:
  //   a) saves always go to the correct doc even if the user switches mid-run
  //   b) switching to a different doc after a run clears stale results
  const runDocIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat]);

  React.useEffect(() => {
    // Pick up any rollback decisions persisted from prior runs (localStorage)
    // so the UI hint is accurate before the user kicks off a new analysis.
    setRollbacks(getRollbackDecisions());
  }, []);

  // Clear stale run output when the user switches to a different document.
  // AutonomousModeView stays mounted across navigations, so without this the
  // previous doc's results would remain visible and the doc-context indicator
  // would show the new doc — making it look like results belong to the new doc.
  React.useEffect(() => {
    if (!runDocIdRef.current) return;          // no run has happened yet
    if (isRunning) return;                     // leave running runs alone
    if (currentDocId === runDocIdRef.current) return; // same doc, nothing to clear
    // Doc changed after a completed run — reset all output state.
    setChat([]);
    setDecisions([]);
    setStrategy(null);
    setRoadmap([]);
    setTopDecision(null);
    setAssumptions([]);
    setVerdict(null);
    setPredictedOutcome(null);
    setPredictionPromptRef(null);
    setUserAccuracy(null);
    setConfidenceExplanation([]);
    setPastIdeas([]);
    setPendingQuestion(null);
    setAnswerText("");
    setSavedDecisionId(null);
    setFollowUpAnswer(null);
    setFollowUpText("");
    setCompetitors([]);
    setFlippedAssumptions(new Set());
    setAgentState("idle");
    runDocIdRef.current = null;
  }, [currentDocId, isRunning]);

  // item 16: elapsed timer
  React.useEffect(() => {
    if (isRunning) {
      setElapsedSeconds(0);
      elapsedTimerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    } else {
      if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
    }
    return () => { if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current); };
  }, [isRunning]);

  // item 13: load recent ideas from Firestore
  React.useEffect(() => {
    if (!user?.uid) return;
    void getRecentPastRuns(user.uid, 8).then(setRecentIdeas);
  }, [user?.uid]);

  // item 25: persist mobile tab to sessionStorage
  React.useEffect(() => {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem("speckula-am-tab", mobileTab);
  }, [mobileTab]);

  // item 10: sync editable roadmap when roadmap changes
  React.useEffect(() => { setEditingRoadmap(roadmap); }, [roadmap]);

  // v2.7+v2.8: hydrate decision-mode settings (mode + auto flag) and the
  // recommendation metadata (score + lastSwitchAt) from Firestore on mount.
  // The agent reuses lastSwitchAtMs for hysteresis without doing its own read.
  React.useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    void Promise.all([
      getDecisionModeSettings(user.uid),
      getDecisionModeMeta(user.uid),
    ]).then(([settings, meta]) => {
      if (cancelled) return;
      setStrictness(settings.mode);
      setAutoModeState(settings.auto);
      setModeMeta(meta);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const handleStrictnessChange = React.useCallback(
    (next: PredictionStrictness) => {
      setStrictness(next);
      if (user?.uid) void setDecisionModeSettings(user.uid, { mode: next as DecisionMode });
    },
    [user?.uid]
  );

  const handleAutoModeChange = React.useCallback(
    (next: boolean) => {
      setAutoModeState(next);
      if (user?.uid) void setDecisionModeSettings(user.uid, { auto: next });
    },
    [user?.uid]
  );

  const appendEntry = React.useCallback((entry: ChatEntryInput) => {
    setChat((prev) => [...prev, { ...entry, id: nextEntryId() }]);
  }, []);

  const handleAgentEvent = React.useCallback((event: AgentEvent) => {
    switch (event.type) {
      case "state":
        setAgentState(event.state);
        break;
      case "thinking":
        appendEntry({ kind: "thinking", text: event.message });
        break;
      case "question":
        setPendingQuestion(event.question);
        appendEntry({ kind: "question", question: event.question });
        break;
      case "decisions":
        setDecisions(event.decisions);
        resumeDataRef.current.decisions = event.decisions;
        appendEntry({ kind: "system", text: `Generated ${event.decisions.length} decisions.` });
        break;
      case "strategy":
        setStrategy(event.strategy);
        resumeDataRef.current.strategy = event.strategy;
        appendEntry({ kind: "system", text: `Strategic theme: "${event.strategy.theme}"` });
        break;
      case "roadmap":
        setRoadmap(event.roadmap);
        resumeDataRef.current.roadmap = event.roadmap;
        appendEntry({ kind: "system", text: `Drafted a ${event.roadmap.length}-phase roadmap.` });
        break;
      case "topDecision":
        setTopDecision(event.decision);
        resumeDataRef.current.topDecision = event.decision;
        break;
      case "assumptions":
        setAssumptions(event.assumptions);
        resumeDataRef.current.assumptions = event.assumptions;
        appendEntry({ kind: "system", text: `Surfaced ${event.assumptions.length} hidden assumption${event.assumptions.length === 1 ? "" : "s"}.` });
        break;
      case "verdict":
        setVerdict(event.verdict);
        resumeDataRef.current.verdict = event.verdict;
        break;
      case "memoryLoaded":
        setPastIdeas(event.pastIdeas);
        break;
      case "expectedOutcome":
        setPredictedOutcome(event.outcome);
        resumeDataRef.current.predictedOutcome = event.outcome;
        if (event.promptRef) {
          setPredictionPromptRef({
            id: event.promptRef.id,
            version: event.promptRef.version,
            hash: event.promptRef.hash,
          });
        }
        appendEntry({
          kind: "system",
          text: `Predicted: ${event.outcome.metric} → ${event.outcome.target}${event.outcome.unit ?? ""} in ${event.outcome.timeframeDays}d (${Math.round(event.outcome.confidence * 100)}% conf.)`,
        });
        break;
      case "feedbackApplied":
        setUserAccuracy(event.userAccuracy);
        // The agent recomputes rollbacks during its feedback-load step.
        // Reading them here picks up any new rollback decisions for display.
        setRollbacks(getRollbackDecisions());
        break;
      case "confidenceExplanation":
        setConfidenceExplanation(event.items);
        break;
      case "modeAutoSwitched": {
        // Reflect the auto-switch in the toggle so the visible state matches
        // what the agent is now running. Refresh the meta so the cooldown
        // timer is accurate for any subsequent run in this session.
        setStrictness(event.to);
        if (user?.uid) {
          void getDecisionModeMeta(user.uid).then((meta) => setModeMeta(meta));
        }
        // v3.0: explainable announcement. e.g.
        //   "Switched to Aggressive due to higher hit rate (+6%)"
        const reasonLabels: Record<string, string> = {
          accuracy: "higher accuracy",
          hit_rate: "higher hit rate",
          calibration: "better calibration",
        };
        const toLabel = event.to.charAt(0).toUpperCase() + event.to.slice(1);
        const text =
          event.reason && typeof event.deltaPct === "number"
            ? `Switched to ${toLabel} due to ${reasonLabels[event.reason] ?? event.reason} (+${event.deltaPct}%)`
            : `Auto mode switched to ${toLabel}`;
        appendEntry({ kind: "system", text });
        break;
      }
      case "checkpoint":
        appendEntry({ kind: "checkpoint", text: event.message });
        break;
      case "error":
        appendEntry({ kind: "error", text: event.message });
        break;
      case "done":
        appendEntry({ kind: "system", text: "Run complete." });
        setMobileTab("output");
        break;
    }
  }, [appendEntry, user?.uid]);

  const startRun = React.useCallback(async (resumeFrom?: AgentResumeData) => {
    const trimmed = idea.trim();
    if (!trimmed || isRunning) return;

    runDocIdRef.current = currentDocId;
    if (!resumeFrom) resumeDataRef.current = {};
    setChat([]);
    setDecisions([]);
    setStrategy(null);
    setRoadmap([]);
    setTopDecision(null);
    setAssumptions([]);
    setVerdict(null);
    setPredictedOutcome(null);
    setPredictionPromptRef(null);
    setUserAccuracy(null);
    setConfidenceExplanation([]);
    setPastIdeas([]);
    setPendingQuestion(null);
    setAnswerText("");
    setFlippedAssumptions(new Set());
    setSavedDecisionId(null);
    setFollowUpAnswer(null);
    setFollowUpText("");
    setCompetitors([]);
    setAgentState("understand_idea");
    setMobileTab("stream");
    appendEntry({ kind: "user", text: resumeFrom ? `↩ Resuming: ${trimmed}` : trimmed });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await runAutonomousAgent({
        idea: trimmed,
        depth,
        signal: controller.signal,
        emit: handleAgentEvent,
        alreadyAsked: [],
        userId: user?.uid,
        strictness,
        autoMode,
        lastSwitchAtMs: modeMeta?.lastSwitchAt?.toDate?.()?.getTime?.() ?? null,
        freezeUntilMs: modeMeta?.freezeUntil?.toDate?.()?.getTime?.() ?? null,
        switchHistoryMs:
          (modeMeta?.switchHistory ?? [])
            .map((t) => t?.toDate?.()?.getTime?.() ?? null)
            .filter((n): n is number => typeof n === "number"),
        resumeData: resumeFrom,
        awaitUserResponse: (question) =>
          new Promise<string>((resolve, reject) => {
            answerResolverRef.current = resolve;
            answerRejecterRef.current = reject;
            setPendingQuestion(question);
          }),
      });
    } finally {
      abortRef.current = null;
      answerResolverRef.current = null;
      answerRejecterRef.current = null;
    }
  }, [idea, depth, isRunning, appendEntry, handleAgentEvent, user?.uid, strictness, autoMode, modeMeta, currentDocId]);

  const start = React.useCallback(() => startRun(), [startRun]);
  const resumeRun = React.useCallback(() => startRun({ ...resumeDataRef.current }), [startRun]);

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
    if (answerRejecterRef.current) {
      const err = new Error("Aborted");
      err.name = "AbortError";
      answerRejecterRef.current(err);
    }
    setPendingQuestion(null);
  }, []);

  const submitAnswer = React.useCallback(() => {
    const text = answerText.trim();
    if (!text || !answerResolverRef.current || !pendingQuestion) return;
    appendEntry({ kind: "user", text });
    answerResolverRef.current(text);
    answerResolverRef.current = null;
    answerRejecterRef.current = null;
    setPendingQuestion(null);
    setAnswerText("");
  }, [answerText, pendingQuestion, appendEntry]);

  const reset = React.useCallback(() => {
    if (isRunning) stop();
    setIdea("");
    setChat([]);
    setDecisions([]);
    setStrategy(null);
    setRoadmap([]);
    setTopDecision(null);
    setAssumptions([]);
    setVerdict(null);
    setPredictedOutcome(null);
    setPredictionPromptRef(null);
    setUserAccuracy(null);
    setConfidenceExplanation([]);
    setPastIdeas([]);
    setPendingQuestion(null);
    setAnswerText("");
    setAgentState("idle");
  }, [isRunning, stop]);

  const handleSaveDecision = React.useCallback(async () => {
    if (!user || !topDecision || isSaving) return;
    setIsSaving(true);
    try {
      // v2.2: persist the predicted outcome and a normalized metric tag so
      // the next run's pattern-accuracy lookup can find this decision once
      // its actual outcome is recorded.
      const expectedOutcomePayload = predictedOutcome
        ? {
            metric: predictedOutcome.metric,
            target_value: predictedOutcome.target,
            baseline: predictedOutcome.baseline,
            unit: predictedOutcome.unit,
            timeframe: `${predictedOutcome.timeframeDays} days`,
          }
        : undefined;

      const newId = await saveDecision(user.uid, {
        title: topDecision.title,
        justification: topDecision.justification,
        priority: topDecision.priority,
        impact: topDecision.impact,
        effort: topDecision.effort,
        userStory: topDecision.userStory,
        tradeoffs: topDecision.tradeoffs,
        summary: topDecision.summary,
        keyInsight: topDecision.keyInsight,
        recommendation: topDecision.recommendation,
        risks: topDecision.risks,
        confidence: topDecision.confidence,
        strategyTheme: strategy?.theme ?? null,
        sourceDocId: (runDocIdRef.current ?? currentDocId) ?? undefined,
        expectedOutcome: expectedOutcomePayload,
        metric: predictedOutcome?.metric.trim().toLowerCase(),
        predictionPromptRef: predictionPromptRef ?? undefined,
        decisionMode: strictness,
      });
      setSavedDecisionId(newId);
      toast.success("Decision saved", topDecision.title);
      activity.success("Decision saved from Autonomous Mode");
      setActiveView("decisions");
    } catch {
      toast.error("Failed to save decision");
    } finally {
      setIsSaving(false);
    }
  }, [user, topDecision, strategy, predictedOutcome, predictionPromptRef, isSaving, currentDocId, strictness, setActiveView]);

  const handleConvertToSpec = React.useCallback(async () => {
    if (!user || !topDecision || isConvertingToSpec) return;
    setIsConvertingToSpec(true);
    try {
      const parts: string[] = [
        `Decision: ${topDecision.title}`,
        topDecision.justification,
      ];
      if (topDecision.userStory) parts.push(`User Story: ${topDecision.userStory}`);
      if (topDecision.keyInsight) parts.push(`Key Insight: ${topDecision.keyInsight}`);
      if (topDecision.recommendation) parts.push(`Recommendation: ${topDecision.recommendation}`);
      if (topDecision.tradeoffs) parts.push(`Tradeoffs: ${topDecision.tradeoffs}`);
      if (topDecision.risks?.length) parts.push(`Risks:\n${topDecision.risks.map(r => `- ${r}`).join("\n")}`);
      if (strategy) {
        parts.push(`Strategic Focus: ${strategy.theme}\n${strategy.rationale}`);
        if (strategy.gaps.length) parts.push(`Gaps:\n${strategy.gaps.map(g => `- ${g}`).join("\n")}`);
      }
      if (roadmap.length) {
        parts.push(`Roadmap:\n${roadmap.map((phase, i) =>
          `Phase ${i + 1} – ${phase.name}: ${phase.goal}\n${phase.deliverables.map(d => `- ${d}`).join("\n")}`
        ).join("\n\n")}`);
      }

      await generatePRDAction(
        user.uid,
        textToTipTap(parts.join("\n\n")),
        topDecision.title,
        (runDocIdRef.current ?? currentDocId) ?? undefined,
      );
      toast.success("Spec created", `PRD: ${topDecision.title}`);
      setActiveView("prds");
    } catch {
      toast.error("Failed to create spec", "Check your API config and try again.");
    } finally {
      setIsConvertingToSpec(false);
    }
  }, [user, topDecision, strategy, roadmap, isConvertingToSpec, currentDocId, setActiveView]);

  const handleCreateTasks = React.useCallback(async () => {
    if (!user || !topDecision || isCreatingTasks) return;
    setIsCreatingTasks(true);
    try {
      const parts: string[] = [
        `Decision: ${topDecision.title}`,
        topDecision.justification,
      ];
      if (topDecision.recommendation) parts.push(`Recommendation: ${topDecision.recommendation}`);
      if (strategy) parts.push(`Strategic Focus: ${strategy.theme}\n${strategy.rationale}`);
      if (roadmap.length) {
        parts.push(`Roadmap:\n${roadmap.map((phase, i) =>
          `Phase ${i + 1} – ${phase.name}: ${phase.goal}\n${phase.deliverables.map(d => `- ${d}`).join("\n")}`
        ).join("\n\n")}`);
      }
      const others = decisions.filter(d => d.title !== topDecision.title);
      if (others.length) {
        parts.push(`Additional decisions:\n${others.map(d => `- ${d.title}: ${d.summary || d.justification}`).join("\n")}`);
      }

      const tasks = await suggestTasksAction(
        user.uid,
        textToTipTap(parts.join("\n\n")),
        (runDocIdRef.current ?? currentDocId) ?? undefined,
      );
      toast.success("Tasks created", `${tasks.length} task${tasks.length === 1 ? "" : "s"} added to your board`);
      setActiveView("tasks");
    } catch {
      toast.error("Failed to create tasks", "Check your API config and try again.");
    } finally {
      setIsCreatingTasks(false);
    }
  }, [user, topDecision, strategy, roadmap, decisions, isCreatingTasks, currentDocId, setActiveView]);

  // item 14: depth change with persistence
  const handleDepthChange = React.useCallback((d: AgentDepth) => {
    setDepth(d);
    if (typeof localStorage !== "undefined") localStorage.setItem("speckula-am-depth", d);
  }, []);

  // item 4: save all decisions
  const handleSaveAllDecisions = React.useCallback(async () => {
    if (!user || !decisions.length || isSavingAll) return;
    setIsSavingAll(true);
    try {
      await Promise.all(decisions.map((d) => saveDecision(user.uid, {
        title: d.title, justification: d.justification, priority: d.priority,
        impact: d.impact, effort: d.effort, userStory: d.userStory, tradeoffs: d.tradeoffs,
        summary: d.summary, keyInsight: d.keyInsight, recommendation: d.recommendation,
        risks: d.risks, confidence: d.confidence, strategyTheme: strategy?.theme ?? null,
        sourceDocId: (runDocIdRef.current ?? currentDocId) ?? undefined, decisionMode: strictness,
      })));
      toast.success("All decisions saved", `${decisions.length} decisions added to your board`);
      activity.success(`Saved ${decisions.length} decisions from Autonomous Mode`);
      setActiveView("decisions");
    } catch { toast.error("Failed to save decisions"); }
    finally { setIsSavingAll(false); }
  }, [user, decisions, strategy, isSavingAll, currentDocId, strictness]);

  // item 22: save decision then publish as public case
  const handlePublishCase = React.useCallback(async () => {
    if (!user || !topDecision || isPublishing) return;
    setIsPublishing(true);
    try {
      const id = savedDecisionId ?? await (async () => {
        const newId = await saveDecision(user.uid, {
          title: topDecision.title, justification: topDecision.justification,
          priority: topDecision.priority, impact: topDecision.impact, effort: topDecision.effort,
          userStory: topDecision.userStory, tradeoffs: topDecision.tradeoffs,
          summary: topDecision.summary, keyInsight: topDecision.keyInsight,
          recommendation: topDecision.recommendation, risks: topDecision.risks,
          confidence: topDecision.confidence, strategyTheme: strategy?.theme ?? null,
          sourceDocId: (runDocIdRef.current ?? currentDocId) ?? undefined, decisionMode: strictness,
        });
        setSavedDecisionId(newId);
        return newId;
      })();
      await publishCase(user.uid, id, {
        title: topDecision.title,
        context: topDecision.justification,
        evidence: decisions.map((d) => d.title),
        insights: assumptions,
        decision: topDecision.recommendation ?? topDecision.title,
        scoring: { impact: topDecision.impact, effort: topDecision.effort, confidence: topDecision.confidence ?? 5, demand: topDecision.demand ?? 5, score: topDecision.impact, reasoning: topDecision.summary },
        risks: topDecision.risks ?? [],
        verdict: { recommendation: verdict?.label === "PROCEED" ? "Build" : verdict?.label === "DO_NOT_BUILD" ? "Delay" : "Validate", rationale: verdict?.reason ?? "" },
      }, { title: topDecision.title, score: topDecision.impact, priority: topDecision.priority });
      toast.success("Case published", "Visible at your public profile");
    } catch { toast.error("Failed to publish case"); }
    finally { setIsPublishing(false); }
  }, [user, topDecision, decisions, assumptions, verdict, strategy, savedDecisionId, isPublishing, currentDocId, strictness]);

  // item 23: send run summary to editor as pending import
  const handleSendToEditor = React.useCallback(async () => {
    if (!user || !topDecision || isSendingToEditor) return;
    setIsSendingToEditor(true);
    try {
      const parts: string[] = [`# Autonomous Run: ${topDecision.title}`];
      if (topDecision.keyInsight) parts.push(`**Key Insight:** ${topDecision.keyInsight}`);
      if (topDecision.recommendation) parts.push(`**Recommendation:** ${topDecision.recommendation}`);
      if (verdict) parts.push(`**Verdict:** ${verdict.label} — ${verdict.reason}`);
      if (predictedOutcome) parts.push(`**Predicted Outcome:** ${predictedOutcome.metric} → ${predictedOutcome.target}${predictedOutcome.unit ?? ""} in ${predictedOutcome.timeframeDays}d`);
      if (assumptions.length) parts.push(`**Assumptions:**\n${assumptions.map((a) => `- ${a}`).join("\n")}`);
      if (strategy) parts.push(`**Strategy:** ${strategy.theme}\n${strategy.rationale}`);
      const docId = await createDocument(user.uid, `Run: ${topDecision.title}`);
      await saveDocument(user.uid, docId, { title: `Run: ${topDecision.title}` });
      markDocumentAsNew(docId);
      setCurrentDocId(docId);
      const allDocs = [{ id: docId, title: `Run: ${topDecision.title}`, updatedAt: null }, ...documents];
      setDocuments(allDocs);
      setPendingImport({ text: parts.join("\n\n"), title: null });
      setActiveView("editor");
      toast.success("Sent to editor", `Run: ${topDecision.title}`);
    } catch { toast.error("Failed to send to editor"); }
    finally { setIsSendingToEditor(false); }
  }, [user, topDecision, verdict, predictedOutcome, assumptions, strategy, isSendingToEditor, documents, setDocuments, setPendingImport, markDocumentAsNew, setCurrentDocId, setActiveView]);

  // item 21: export run as markdown
  const handleExport = React.useCallback(() => {
    if (!topDecision) return;
    const lines: string[] = [`# Autonomous Run: ${topDecision.title}`, `*${new Date().toLocaleDateString()}*`, ""];
    if (verdict) lines.push(`## Verdict: ${verdict.label}`, verdict.reason, "");
    if (predictedOutcome) lines.push(`## Predicted Outcome`, `**${predictedOutcome.metric}:** ${predictedOutcome.baseline ?? "?"}${predictedOutcome.unit ?? ""} → ${predictedOutcome.target}${predictedOutcome.unit ?? ""} in ${predictedOutcome.timeframeDays}d (${Math.round(predictedOutcome.confidence * 100)}% confidence)`, "");
    lines.push("## Decisions", ...decisions.map((d) => `### ${d.title}\n${d.summary || d.justification}\n- Impact: ${d.impact} | Effort: ${d.effort}\n${d.risks?.length ? `- Risks: ${d.risks.join("; ")}` : ""}`), "");
    if (assumptions.length) lines.push("## Assumptions", ...assumptions.map((a) => `- ${a}`), "");
    if (strategy) lines.push("## Strategy", `**${strategy.theme}**`, strategy.rationale, "");
    if (roadmap.length) lines.push("## Roadmap", ...roadmap.map((p, i) => `### Phase ${i + 1}: ${p.name}\n${p.goal}\n${p.deliverables.map((d) => `- ${d}`).join("\n")}`));
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `run-${topDecision.title.toLowerCase().replace(/\s+/g, "-")}.md`; a.click();
    URL.revokeObjectURL(url);
  }, [topDecision, verdict, predictedOutcome, decisions, assumptions, strategy, roadmap]);

  // item 11: load competitor signals
  const handleLoadCompetitors = React.useCallback(async () => {
    if (!idea.trim() || isLoadingCompetitors) return;
    setIsLoadingCompetitors(true);
    try {
      const results = await generateCompetitorAnalysis(idea.trim());
      setCompetitors(results);
    } catch { toast.error("Failed to load competitor signals"); }
    finally { setIsLoadingCompetitors(false); }
  }, [idea, isLoadingCompetitors]);

  // item 3: follow-up Q&A
  const handleFollowUp = React.useCallback(async () => {
    const q = followUpText.trim();
    if (!q || isFollowingUp) return;
    setIsFollowingUp(true);
    setFollowUpAnswer(null);
    const ctrl = new AbortController();
    followUpAbortRef.current = ctrl;
    try {
      const ctx = [
        topDecision ? `Top Decision: ${topDecision.title}\n${topDecision.justification}` : "",
        verdict ? `Verdict: ${verdict.label} — ${verdict.reason}` : "",
        strategy ? `Strategy: ${strategy.theme}\n${strategy.rationale}` : "",
        assumptions.length ? `Assumptions:\n${assumptions.join("\n")}` : "",
        predictedOutcome ? `Predicted: ${predictedOutcome.metric} → ${predictedOutcome.target}${predictedOutcome.unit ?? ""}` : "",
      ].filter(Boolean).join("\n\n");
      const answer = await queryAboutRun(ctx, q, ctrl.signal);
      setFollowUpAnswer(answer);
      setFollowUpText("");
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Follow-up failed");
    } finally { setIsFollowingUp(false); followUpAbortRef.current = null; }
  }, [followUpText, isFollowingUp, topDecision, verdict, strategy, assumptions, predictedOutcome]);

  // item 5: re-run with flipped assumptions injected into the idea
  const handleWhatIfRun = React.useCallback(() => {
    if (!flippedAssumptions.size || isRunning) return;
    const flipped = assumptions.filter((_, i) => flippedAssumptions.has(i));
    const suffix = `\n\nChallenge these assumptions (treat as potentially false):\n${flipped.map((a) => `- ${a}`).join("\n")}`;
    setIdea((prev) => prev.trim() + suffix);
    setFlippedAssumptions(new Set());
    toast.success("Assumptions injected", "Press Analyze to run the what-if scenario");
  }, [flippedAssumptions, assumptions, isRunning]);

  const activeStep = getActiveStep(agentState);
  const hasOutput = decisions.length > 0 || !!strategy || roadmap.length > 0 || !!verdict || !!predictedOutcome;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 h-12 border-b border-border shrink-0 bg-card">
        <div className="flex items-center gap-2.5">
          <Bot className="h-4 w-4 text-primary" />
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] font-medium">Autonomous Mode</span>
          {agentState !== "idle" && <AgentStatePill state={agentState} />}
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              onClick={stop}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] font-mono text-[11px] font-medium border border-destructive/40 text-destructive bg-destructive/5 hover:bg-destructive/10 transition-all"
            >
              <StopCircle className="h-3 w-3" /> Stop
            </button>
          )}
          {(isDone || agentState === "stopped" || agentState === "error") && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] font-mono text-[11px] font-medium border border-border text-foreground bg-card hover:bg-muted transition-all"
            >
              <RotateCcw className="h-3 w-3" /> New run
            </button>
          )}
        </div>
      </header>

      {/* ── Mobile tab bar (xs/sm/md only) ── */}
      <div className="lg:hidden flex border-b border-border shrink-0 bg-card">
        {(["input", "stream", "output"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors ${
              mobileTab === tab
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "input" ? "Input" : tab === "stream" ? "Stream" : "Output"}
          </button>
        ))}
      </div>

      {/* ── Three-panel body ── */}
      <div
        className="flex-1 flex overflow-hidden"
        onTouchStart={(e) => { (e.currentTarget as HTMLDivElement & { _touchX?: number })._touchX = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const el = e.currentTarget as HTMLDivElement & { _touchX?: number };
          const dx = e.changedTouches[0].clientX - (el._touchX ?? 0);
          if (Math.abs(dx) < 40) return;
          const tabs: Array<"input" | "stream" | "output"> = ["input", "stream", "output"];
          const idx = tabs.indexOf(mobileTab);
          if (dx < 0 && idx < 2) setMobileTab(tabs[idx + 1]);
          if (dx > 0 && idx > 0) setMobileTab(tabs[idx - 1]);
        }}
      >

        {/* LEFT: Command input + mode cards + stepper */}
        <aside className={`${mobileTab !== "input" ? "hidden lg:flex" : "flex"} w-full lg:w-[272px] lg:shrink-0 flex-col border-r border-border bg-card overflow-y-auto custom-scrollbar`}>
          <div className="p-5 flex flex-col gap-5">

            {/* Command input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60">
                  What do you want to build?
                </label>
                <div className="flex items-center gap-1.5">
                  {/* item 2: doc context indicator */}
                  {currentDocId && documents.find((d) => d.id === currentDocId) && (
                    <span className="inline-flex items-center gap-1 font-mono text-[9px] text-primary/60 border border-primary/20 rounded px-1.5 py-0.5">
                      <BookOpen className="h-2.5 w-2.5" />
                      {documents.find((d) => d.id === currentDocId)?.title?.slice(0, 14) ?? "Doc"}
                    </span>
                  )}
                  {/* item 13: history dropdown */}
                  {recentIdeas.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowHistory((v) => !v)}
                        disabled={isRunning}
                        className="flex items-center gap-1 p-1 rounded text-muted-foreground/50 hover:text-foreground disabled:opacity-40 transition-colors"
                        title="Recent ideas"
                      >
                        <History className="h-3 w-3" />
                      </button>
                      {showHistory && (
                        <div className="absolute right-0 top-6 z-20 w-64 rounded-lg border border-border bg-card shadow-lg p-1">
                          {recentIdeas.map((r, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => { setIdea(r.idea); setShowHistory(false); }}
                              className="w-full text-left px-3 py-2 rounded-md text-[11px] text-foreground/80 hover:bg-muted truncate"
                            >
                              {r.idea}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Describe your product idea…"
                rows={4}
                disabled={isRunning || !!pendingQuestion}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    start();
                  }
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-50 placeholder:text-muted-foreground/40"
              />
              {/* item 12: idea templates */}
              <div className="flex flex-wrap gap-1">
                {[["New feature", "We want to add a feature that helps users…"], ["Pivot", "We're considering pivoting from… to…"], ["0→1", "We're building a brand-new product that solves…"], ["Pricing change", "We want to change our pricing model to…"]].map(([label, template]) => (
                  <button
                    key={label}
                    type="button"
                    disabled={isRunning}
                    onClick={() => setIdea((prev) => prev.trim() ? prev : template)}
                    className="px-2 py-0.5 rounded border border-border/60 font-mono text-[9px] text-muted-foreground/60 hover:text-foreground hover:border-border transition-all disabled:opacity-40"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="font-mono text-[9px] text-muted-foreground/35">⌘↵ to run</p>
            </div>

            {/* Depth selector — compact pills */}
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60">Depth</label>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {depthOptions.map((opt) => {
                  const Icon = opt.icon;
                  const active = depth === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => !isRunning && handleDepthChange(opt.id)}
                      disabled={isRunning}
                      title={opt.hint}
                      className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-r last:border-r-0 border-border ${
                        active ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 bg-transparent"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="font-mono text-[10px] font-medium">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="font-mono text-[9px] text-muted-foreground/40">
                {depthOptions.find(o => o.id === depth)?.description}
              </p>
            </div>

            {/* Prediction mode — compact pills + auto toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60">Mode</label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <span className="font-mono text-[9px] text-muted-foreground/60">Auto</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoMode}
                    onClick={() => !isRunning && handleAutoModeChange(!autoMode)}
                    disabled={isRunning}
                    className={`relative h-3.5 w-7 rounded-full transition-colors disabled:opacity-50 ${autoMode ? "bg-primary/80" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-card transition-all ${autoMode ? "left-3.5" : "left-0.5"}`} />
                  </button>
                </label>
              </div>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {STRICTNESS_OPTIONS.map((opt) => {
                  const active = strictness === opt.id;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => !isRunning && !autoMode && handleStrictnessChange(opt.id)}
                      disabled={isRunning || autoMode}
                      title={opt.hint}
                      className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed border-r last:border-r-0 border-border ${
                        active ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 bg-transparent"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      <span className="font-mono text-[9px] font-medium">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              {(() => {
                if (autoMode || !modeMeta || modeMeta.recommendedMode === strictness) return null;
                const metaAny = modeMeta as DecisionModeMeta & { score?: number; previousScore?: number };
                const recScore = metaAny.score;
                const prevScore = metaAny.previousScore;
                if (typeof recScore !== "number" || !Number.isFinite(recScore)) return null;
                const deltaPct = typeof prevScore === "number" && Number.isFinite(prevScore) && prevScore > 0
                  ? Math.round(((recScore - prevScore) / prevScore) * 100) : null;
                const deltaText = deltaPct !== null && deltaPct > 0 ? `+${deltaPct}% accuracy` : "better calibration";
                return (
                  <p className="font-mono text-[9px] text-success/80">
                    Tip: <span className="capitalize font-medium">{modeMeta.recommendedMode}</span> — {deltaText}
                  </p>
                );
              })()}
            </div>

            {/* Analyze button + elapsed time (item 16) */}
            <div className="space-y-1">
              <button
                onClick={start}
                disabled={!idea.trim() || isRunning}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg font-mono text-[12px] font-medium text-primary-foreground bg-primary hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isRunning
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing…</>
                  : <><Sparkles className="h-3.5 w-3.5" /> Analyze</>
                }
              </button>
              {isRunning && (
                <div className="flex items-center justify-center gap-1 font-mono text-[9px] text-muted-foreground/50">
                  <Clock className="h-2.5 w-2.5" />
                  <span>{Math.floor(elapsedSeconds / 60).toString().padStart(2, "0")}:{(elapsedSeconds % 60).toString().padStart(2, "0")}</span>
                </div>
              )}
            </div>

            {/* Stepper */}
            {agentState !== "idle" && (
              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60">
                  Progress
                </label>
                <AgentStepper activeStep={activeStep} isRunning={isRunning} />
              </div>
            )}

            {/* Memory hint */}
            {pastIdeas.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground/60">
                <span className="text-foreground/50 font-medium">Memory:</span>{" "}
                primed with {pastIdeas.length} past run{pastIdeas.length === 1 ? "" : "s"}
              </div>
            )}

            {/* Feedback hint */}
            {userAccuracy !== null && (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground/60 flex items-center gap-1.5">
                {userAccuracy >= 0.5
                  ? <TrendingUp className="h-3 w-3 text-success/70" />
                  : <TrendingDown className="h-3 w-3 text-warning/70" />}
                <span>
                  <span className="text-foreground/50 font-medium">Track record:</span>{" "}
                  {Math.round(userAccuracy * 100)}% accuracy — confidence{" "}
                  {userAccuracy >= 0.5 ? "boosted" : "penalized"} by ~{Math.round(Math.abs(userAccuracy - 0.5) * 30)}%
                </span>
              </div>
            )}

            {/* Prompt improvement signal — surfaces when the agent has rolled
                back to a previously-better-performing prompt version. Uses
                the rolling-window delta (previous − recent) so the percentage
                reflects the actual shift the rollback is responding to. */}
            {rollbacks.length > 0 && (
              <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-[10px] text-foreground/70 space-y-1">
                {rollbacks.slice(0, 2).map((r) => {
                  // Skip rollbacks without enough sample data on either window.
                  if (r.recentRuns < 30 || r.previousRuns < 30) return null;
                  const improvementPct = Math.round((r.previousAccuracy - r.recentAccuracy) * 100);
                  if (improvementPct <= 0) return null;
                  return (
                    <div key={r.promptId} className="flex items-start gap-1.5">
                      <TrendingUp className="h-3 w-3 text-success/80 shrink-0 mt-0.5" />
                      <span>
                        Prompt <span className="font-mono text-foreground/85">v{r.toVersion}</span> improving outcomes (+{improvementPct}% vs previous)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* CENTER: Agent stream */}
        <section className={`${mobileTab !== "stream" ? "hidden lg:flex" : "flex"} flex-col border-r border-border overflow-hidden w-full lg:w-[340px] lg:shrink-0`}>
          <div className="px-4 py-2.5 border-b border-border shrink-0 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/50">Agent stream</span>
            {/* item 18: stream filter toggle */}
            <button
              type="button"
              onClick={() => setShowThinking((v) => !v)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[9px] border transition-all ${showThinking ? "border-border text-muted-foreground/60 bg-transparent" : "border-primary/30 text-primary bg-primary/5"}`}
              title={showThinking ? "Hide thinking entries" : "Show thinking entries"}
            >
              <Brain className="h-2.5 w-2.5" />
              {showThinking ? "All" : "Events only"}
            </button>
          </div>

          <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 custom-scrollbar">
            {chat.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="h-9 w-9 rounded-full border border-border flex items-center justify-center mb-3">
                  <Bot className="h-4 w-4 text-muted-foreground/40" />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/50">System idle</p>
                <p className="text-[11px] text-muted-foreground/40 mt-1 max-w-[180px] leading-relaxed">
                  Thinking and events will stream here
                </p>
              </div>
            )}

            {chat.filter((e) => showThinking || e.kind !== "thinking").map((entry) => (
              <StreamEntry key={entry.id} entry={entry} />
            ))}

            {isRunning && agentState !== "awaiting_user" && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50 py-1 pl-0.5">
                <span className="flex gap-0.5">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="h-1 w-1 rounded-full bg-current animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </span>
                <span className="font-mono">Processing</span>
              </div>
            )}
          </div>

          {/* item 20: error/stopped retry + resume */}
          {(agentState === "error" || agentState === "stopped") && (
            <div className="border-t border-border p-3 bg-card shrink-0 flex items-center gap-2">
              <button
                onClick={start}
                disabled={!idea.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] font-mono text-[11px] font-medium border border-border bg-card text-foreground hover:bg-muted transition-all disabled:opacity-40"
              >
                <RefreshCw className="h-3 w-3" /> Retry fresh
              </button>
              {Object.keys(resumeDataRef.current).length > 0 && (
                <button
                  onClick={resumeRun}
                  disabled={!idea.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] font-mono text-[11px] font-medium border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-all disabled:opacity-40"
                >
                  <PlayCircle className="h-3 w-3" /> Resume
                </button>
              )}
            </div>
          )}

          {/* Q&A answer box */}
          {pendingQuestion && (
            <div className="border-t border-border p-3 bg-primary/[0.04] shrink-0">
              <div className="flex items-start gap-2 mb-2.5">
                <HelpCircle className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-foreground/80 leading-relaxed">
                  {pendingQuestion.why ?? "Your answer is needed to proceed."}
                </p>
              </div>
              {/* item 17: suggested answers */}
              {pendingQuestion.options && pendingQuestion.options.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {pendingQuestion.options.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setAnswerText(opt); }}
                      className="px-2.5 py-1 rounded-full border border-primary/25 bg-primary/5 font-mono text-[10px] text-primary hover:bg-primary/10 transition-all"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Your answer…"
                  className="flex-1 h-8 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitAnswer(); }
                  }}
                  autoFocus
                />
                <button
                  onClick={submitAnswer}
                  disabled={!answerText.trim()}
                  className="flex items-center gap-1 px-3 h-8 rounded-[4px] font-mono text-[11px] font-medium text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="h-3 w-3" /> Send
                </button>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT: Intelligence output */}
        <section className={`${mobileTab !== "output" ? "hidden lg:flex" : "flex"} flex-1 flex-col overflow-hidden`}>
          {/* Header */}
          <div className="px-5 pt-2.5 pb-0 border-b border-border shrink-0 bg-card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/50">Intelligence Output</span>
                {isDone && <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20">Complete</span>}
              </div>
              <div className="flex items-center gap-2">
                {decisions.length > 0 && outputTab === "decisions" && (
                  <div className="flex items-center rounded border border-border p-0.5 gap-0.5">
                    <button type="button" onClick={() => setOutputView("cards")} className={`p-1 rounded transition-colors ${outputView === "cards" ? "bg-muted text-foreground" : "text-muted-foreground/50 hover:text-foreground"}`} title="Card view"><LayoutList className="h-3 w-3" /></button>
                    <button type="button" onClick={() => setOutputView("table")} className={`p-1 rounded transition-colors ${outputView === "table" ? "bg-muted text-foreground" : "text-muted-foreground/50 hover:text-foreground"}`} title="Table view"><Table2 className="h-3 w-3" /></button>
                  </div>
                )}
              </div>
            </div>
            {/* Tab bar — only shows when there's output */}
            {hasOutput && (
              <div className="flex gap-0.5 -mb-px">
                {(([
                  { id: "overview",   label: "Overview"  },
                  { id: "decisions",  label: `Decisions${decisions.length ? ` · ${decisions.length}` : ""}` },
                  { id: "strategy",   label: "Strategy",  hidden: !strategy && assumptions.length === 0 },
                  { id: "roadmap",    label: "Roadmap",   hidden: roadmap.length === 0 },
                ]) as { id: "overview"|"decisions"|"strategy"|"roadmap"; label: string; hidden?: boolean }[])
                  .filter(t => !t.hidden)
                  .map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setOutputTab(tab.id)}
                      className={`px-3.5 py-1.5 font-mono text-[10px] rounded-t transition-colors ${
                        outputTab === tab.id
                          ? "text-primary bg-primary/[0.06] border border-b-card border-border"
                          : "text-muted-foreground/50 hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))
                }
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {!hasOutput && !isRunning ? (
              <OutputSkeleton />
            ) : (
              <OutputPanel
                decisions={decisions}
                strategy={strategy}
                roadmap={editingRoadmap}
                topDecision={topDecision}
                assumptions={assumptions}
                verdict={verdict}
                predictedOutcome={predictedOutcome}
                confidenceExplanation={confidenceExplanation}
                competitors={competitors}
                isRunning={isRunning}
                depth={depth}
                outputView={outputView}
                activeTab={outputTab}
                expandedDecisions={expandedDecisions}
                onToggleExpand={(i) => setExpandedDecisions((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; })}
                flippedAssumptions={flippedAssumptions}
                onFlipAssumption={(i) => setFlippedAssumptions((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; })}
                editingPhase={editingPhase}
                onEditPhase={setEditingPhase}
                onUpdatePhase={(i, field, value) => setEditingRoadmap((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))}
                accuracyHistory={accuracyHistory}
              />
            )}
          </div>

          {/* item 3: follow-up Q&A + item 5: what-if button */}
          {isDone && (
            <div className="border-t border-border shrink-0 bg-card/50">
              {/* what-if re-run trigger */}
              {flippedAssumptions.size > 0 && (
                <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-warning shrink-0" />
                  <span className="text-[11px] text-foreground/70 flex-1">{flippedAssumptions.size} assumption(s) flipped.</span>
                  <button onClick={handleWhatIfRun} className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] font-mono text-[10px] font-medium border border-warning/40 text-warning bg-warning/5 hover:bg-warning/10 transition-all">
                    <RefreshCw className="h-2.5 w-2.5" /> What-if
                  </button>
                </div>
              )}
              {/* follow-up Q&A */}
              <div className="px-4 py-3 space-y-2">
                <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/40 flex items-center gap-1">
                  <MessageSquare className="h-2.5 w-2.5" /> Ask a follow-up
                </div>
                {followUpAnswer && (
                  <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-foreground/80 leading-relaxed">
                    {followUpAnswer}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={followUpText}
                    onChange={(e) => setFollowUpText(e.target.value)}
                    placeholder="Ask about this run…"
                    className="flex-1 h-7 text-xs"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleFollowUp(); } }}
                  />
                  <button
                    onClick={handleFollowUp}
                    disabled={!followUpText.trim() || isFollowingUp}
                    className="flex items-center gap-1 px-2.5 h-7 rounded-[4px] font-mono text-[10px] font-medium text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-40 transition-all"
                  >
                    {isFollowingUp ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Send className="h-2.5 w-2.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action bar — shown once complete */}
          {isDone && (
            <div className="border-t border-border shrink-0 bg-card px-4 py-3 flex items-center gap-2 flex-wrap">
              {/* Primary actions */}
              <button
                onClick={handleSaveDecision}
                disabled={!topDecision || isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] font-semibold text-primary-foreground bg-primary hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                {isSaving ? "Saving…" : "Save Decision"}
              </button>
              <button
                onClick={handleSaveAllDecisions}
                disabled={!decisions.length || isSavingAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] font-medium border border-border bg-card text-foreground hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSavingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                {isSavingAll ? "Saving…" : `Save All (${decisions.length})`}
              </button>
              <button
                onClick={handleConvertToSpec}
                disabled={!topDecision || isConvertingToSpec}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] font-medium border border-border bg-card text-foreground hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isConvertingToSpec ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                {isConvertingToSpec ? "Creating…" : "Convert to Spec"}
              </button>
              <button
                onClick={handleCreateTasks}
                disabled={!topDecision || isCreatingTasks}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] font-medium border border-border bg-card text-foreground hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isCreatingTasks ? <Loader2 className="h-3 w-3 animate-spin" /> : <ListTodo className="h-3 w-3" />}
                {isCreatingTasks ? "Creating…" : "Create Tasks"}
              </button>
              {/* Divider */}
              <div className="w-px h-5 bg-border/60 mx-0.5" />
              {/* Secondary actions */}
              <button onClick={handleSendToEditor} disabled={!topDecision || isSendingToEditor} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {isSendingToEditor ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
                {isSendingToEditor ? "Sending…" : "Send to Editor"}
              </button>
              <button onClick={handlePublishCase} disabled={!topDecision || isPublishing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {isPublishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3" />}
                {isPublishing ? "Publishing…" : "Share as Case"}
              </button>
              <button onClick={handleExport} disabled={!topDecision} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <Download className="h-3 w-3" /> Export .md
              </button>
              <button onClick={handleLoadCompetitors} disabled={isLoadingCompetitors || !idea.trim()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {isLoadingCompetitors ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
                {isLoadingCompetitors ? "Loading…" : "Market Signals"}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── AgentStatePill ────────────────────────────────────────────────────────────

function AgentStatePill({ state }: { state: AgentState }) {
  const tone =
    state === "error"       ? "border-destructive/30 bg-destructive/10 text-destructive" :
    state === "stopped"     ? "border-border bg-muted text-muted-foreground" :
    state === "output"      ? "border-success/30 bg-success/10 text-success" :
    state === "awaiting_user" ? "border-warning/30 bg-warning/10 text-warning" :
    "border-primary/20 bg-primary/10 text-primary";

  const label =
    state === "output"        ? "Done" :
    state === "stopped"       ? "Stopped" :
    state === "error"         ? "Error" :
    state === "awaiting_user" ? "Awaiting answer" :
    "Running";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium ${tone}`}>
      <span className="h-1 w-1 rounded-full bg-current animate-pulse" />
      {label}
    </span>
  );
}

// ── AgentStepper ──────────────────────────────────────────────────────────────

function AgentStepper({ activeStep, isRunning }: { activeStep: number; isRunning: boolean }) {
  return (
    <div>
      {STEPPER_STEPS.map((step, i) => {
        const done   = activeStep > i;
        const active = activeStep === i;
        return (
          <div key={i} className="flex items-start gap-2.5">
            <div className="flex flex-col items-center shrink-0">
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-all ${
                done   ? "border-success/60 bg-success/15 text-success" :
                active ? "border-primary bg-primary/10 text-primary" :
                         "border-border bg-transparent text-muted-foreground/30"
              }`}>
                {done ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : active ? (
                  isRunning
                    ? <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                    : <span className="h-1 w-1 rounded-full bg-current" />
                ) : (
                  <span className="h-1 w-1 rounded-full bg-current opacity-50" />
                )}
              </div>
              {i < STEPPER_STEPS.length - 1 && (
                <div className={`w-0.5 h-4 mt-0.5 ${done ? "bg-success/30" : "bg-border/60"}`} />
              )}
            </div>
            <div className="pb-3 min-w-0">
              <div className={`text-[11px] font-medium leading-tight transition-colors ${
                done   ? "text-success/80" :
                active ? "text-foreground" :
                         "text-muted-foreground/40"
              }`}>
                {step.label}
              </div>
              {active && (
                <div className="text-[10px] text-muted-foreground/55 mt-0.5 leading-snug">{step.sublabel}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── StreamEntry ───────────────────────────────────────────────────────────────

function StreamEntry({ entry }: { entry: ChatEntry }) {
  if (entry.kind === "user") {
    return (
      <div className="rounded-xl border border-primary/25 bg-primary/[0.07] px-3.5 py-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-primary/70 font-semibold">Idea</span>
        </div>
        <p className="text-[12px] font-medium leading-relaxed text-foreground">{entry.text}</p>
      </div>
    );
  }
  if (entry.kind === "thinking") {
    return (
      <div className="flex items-start gap-2.5 pl-1">
        <Brain className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/30" />
        <p className="text-[11px] text-muted-foreground/55 leading-relaxed">{entry.text}</p>
      </div>
    );
  }
  if (entry.kind === "question") {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/[0.06] px-3.5 py-3">
        <div className="flex items-center gap-1.5 mb-2">
          <HelpCircle className="h-3 w-3 text-warning" />
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-warning font-semibold">Needs input</span>
        </div>
        <p className="text-[12px] font-medium text-foreground leading-relaxed">{entry.question.question}</p>
        {entry.question.why && (
          <p className="text-[10px] text-muted-foreground/60 mt-1.5 leading-relaxed">{entry.question.why}</p>
        )}
      </div>
    );
  }
  if (entry.kind === "system") {
    return (
      <div className="flex items-center gap-2 py-0.5 pl-1">
        <CheckCircle2 className="h-3 w-3 text-success/70 shrink-0" />
        <span className="font-mono text-[10px] text-foreground/60">{entry.text}</span>
      </div>
    );
  }
  if (entry.kind === "checkpoint") {
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="h-px flex-1 bg-border/50" />
        <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-full bg-muted/50 border border-border/50">
          <MapPin className="h-2.5 w-2.5 text-primary/60" />
          <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/60">{entry.text}</span>
        </div>
        <div className="h-px flex-1 bg-border/50" />
      </div>
    );
  }
  return (
    <div className="rounded-lg border-l-2 border-l-destructive bg-destructive/[0.05] px-3 py-2.5">
      <span className="font-mono text-[10px] text-destructive font-semibold">Error · </span>
      <span className="text-[11px] text-foreground/80">{entry.text}</span>
    </div>
  );
}

// ── OutputSkeleton ────────────────────────────────────────────────────────────

function OutputSkeleton() {
  return (
    <div className="p-6 space-y-5">
      <div className="space-y-2">
        <div className="h-2 rounded-full bg-muted/50 animate-pulse w-20" />
        <div className="h-[76px] rounded-xl bg-muted/30 animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-2 rounded-full bg-muted/50 animate-pulse w-28" />
        <div className="h-16 rounded-xl bg-muted/30 animate-pulse" />
        <div className="h-16 rounded-xl bg-muted/30 animate-pulse" />
        <div className="h-16 rounded-xl bg-muted/25 animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-2 rounded-full bg-muted/50 animate-pulse w-24" />
        <div className="h-20 rounded-xl bg-muted/30 animate-pulse" />
      </div>
      <div className="flex items-center gap-2 mt-6 text-muted-foreground/25">
        <Cpu className="h-3.5 w-3.5" />
        <span className="font-mono text-[10px] uppercase tracking-[0.08em]">Waiting for input</span>
      </div>
    </div>
  );
}

// ── OutputPanel ───────────────────────────────────────────────────────────────

interface OutputPanelProps {
  decisions: DecisionSuggestion[];
  strategy: StrategicGuidance | null;
  roadmap: RoadmapPhase[];
  topDecision: DecisionSuggestion | null;
  assumptions: string[];
  verdict: Verdict | null;
  predictedOutcome: PredictedOutcome | null;
  confidenceExplanation: ConfidenceExplanationItem[];
  competitors: CompetitorSignal[];
  isRunning: boolean;
  depth: AgentDepth;
  outputView: "cards" | "table";
  activeTab: "overview" | "decisions" | "strategy" | "roadmap";
  expandedDecisions: Set<number>;
  onToggleExpand: (i: number) => void;
  flippedAssumptions: Set<number>;
  onFlipAssumption: (i: number) => void;
  editingPhase: number | null;
  onEditPhase: (i: number | null) => void;
  onUpdatePhase: (i: number, field: string, value: string) => void;
  accuracyHistory: number[];
}

function OutputPanel({ decisions, strategy, roadmap, topDecision, assumptions, verdict, predictedOutcome, confidenceExplanation, competitors, isRunning, depth, outputView, activeTab, expandedDecisions, onToggleExpand, flippedAssumptions, onFlipAssumption, editingPhase, onEditPhase, onUpdatePhase, accuracyHistory }: OutputPanelProps) {
  const showOverview   = activeTab === "overview";
  const showDecisions  = activeTab === "decisions";
  const showStrategy   = activeTab === "strategy";
  const showRoadmap    = activeTab === "roadmap";

  return (
    <div className="p-5 space-y-5 max-w-2xl">

      {/* ── Overview tab ───────────────────────────────────────────────────── */}
      {showOverview && (
        <>
          {topDecision && (
            <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] to-transparent p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-2">
                <Flame className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-primary font-medium">Top Decision</span>
              </div>
              <h3 className="text-[14px] font-semibold text-foreground leading-snug">{topDecision.title}</h3>
              {topDecision.keyInsight && (
                <p className="text-[12px] text-muted-foreground leading-relaxed mt-1.5">{topDecision.keyInsight}</p>
              )}
              {topDecision.recommendation && (
                <div className="flex items-start gap-1.5 mt-3 pt-3 border-t border-primary/15">
                  <Target className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <p className="text-[12px] text-foreground/85 leading-relaxed font-medium">{topDecision.recommendation}</p>
                </div>
              )}
            </div>
          )}
          {confidenceExplanation.length > 0 && <ConfidenceExplanationPills items={confidenceExplanation} />}
          {verdict && <VerdictBlock verdict={verdict} />}
          {predictedOutcome && <ExpectedOutcomeBlock outcome={predictedOutcome} />}
          {!isRunning && depth === "quick" && roadmap.length === 0 && decisions.length > 0 && (
            <p className="font-mono text-[10px] text-muted-foreground/45">
              Quick mode skipped the roadmap. Switch to Standard or Deep for a full plan.
            </p>
          )}
        </>
      )}

      {/* ── Decisions tab ──────────────────────────────────────────────────── */}
      {showDecisions && (
        <>
          {decisions.length > 0 && outputView === "table" ? (
            <OutputBlock label="Decisions" icon={Compass}>
              <DecisionTable decisions={decisions} />
            </OutputBlock>
          ) : decisions.length > 0 ? (
            <OutputBlock label="Decisions" icon={Compass}>
              <div className="space-y-2.5">
                {decisions.map((d, i) => (
                  <DecisionCard key={`${d.title}-${i}`} decision={d} expanded={expandedDecisions.has(i)} onToggleExpand={() => onToggleExpand(i)} />
                ))}
              </div>
            </OutputBlock>
          ) : null}
          {decisions.some((d) => d.risks && d.risks.length > 0) && (
            <OutputBlock label="Risks" icon={AlertTriangle}>
              <div className="space-y-1.5">
                {decisions.flatMap((d) => (d.risks ?? []).map((r) => ({ risk: r, title: d.title }))).map(({ risk, title }, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <AlertTriangle className="h-2.5 w-2.5 text-destructive/60 mt-0.5 shrink-0" />
                    <span className="text-foreground/75 leading-relaxed">{title}: {risk}</span>
                  </div>
                ))}
              </div>
            </OutputBlock>
          )}
        </>
      )}

      {/* ── Strategy tab ───────────────────────────────────────────────────── */}
      {showStrategy && decisions.some((d) => d.costModel) && (
        <OutputBlock label="Cost Analysis" icon={DollarSign}>
          <div className="space-y-2">
            {decisions.filter((d) => d.costModel).map((d, i) => (
              <div key={i} className="rounded-lg border border-border/60 bg-card p-3">
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <span className="text-[11px] font-medium text-foreground leading-snug truncate">{d.title}</span>
                  {d.costModel && <CostBadge category={d.costModel.category} />}
                </div>
                {d.costModel && (
                  <>
                    <div className="flex flex-wrap gap-2 font-mono text-[10px] text-muted-foreground/70 mb-1">
                      <span>~${d.costModel.estimatedMonthly}/mo baseline</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span>Infra ${d.costModel.breakdown.infrastructure}</span>
                      <span>LLM ${d.costModel.breakdown.llm_api}</span>
                      <span>Ops ${d.costModel.breakdown.ops_labor}</span>
                    </div>
                    {d.costModel.scalingTrajectory && (
                      <p className="text-[10px] text-muted-foreground/55 leading-relaxed">{d.costModel.scalingTrajectory}</p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </OutputBlock>
      )}

      {showStrategy && decisions.some((d) => d.keyInsight) && (
        <OutputBlock label="Key Insights" icon={Lightbulb}>
          <ul className="space-y-2">
            {decisions.filter((d) => d.keyInsight).map((d, i) => (
              <li key={i} className="rounded-lg border border-border/60 bg-card px-3 py-2.5">
                <span className="font-mono text-[10px] font-semibold text-primary/80">{d.title}: </span>
                <span className="text-[11px] text-foreground/80 leading-relaxed">{d.keyInsight}</span>
              </li>
            ))}
          </ul>
        </OutputBlock>
      )}

      {showStrategy && (assumptions.length > 0 || strategy) && (
        <OutputBlock label="Argument" icon={Brain}>
          {assumptions.length > 0 && (
            <div className="rounded-lg border border-warning/25 bg-warning/[0.05] p-3 mb-2.5">
              <div className="flex items-center justify-between mb-2">
                <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-warning">Hidden assumptions</div>
                {flippedAssumptions.size > 0 && (
                  <span className="font-mono text-[9px] text-primary">{flippedAssumptions.size} flipped for what-if</span>
                )}
              </div>
              <ul className="space-y-1.5">
                {assumptions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-foreground/80 leading-relaxed">
                    <button
                      type="button"
                      onClick={() => onFlipAssumption(i)}
                      className={`mt-0.5 shrink-0 transition-colors ${flippedAssumptions.has(i) ? "text-primary" : "text-warning/80 hover:text-primary"}`}
                      title={flippedAssumptions.has(i) ? "Unflip assumption" : "Flip for what-if re-run"}
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                    </button>
                    <span className={flippedAssumptions.has(i) ? "line-through text-muted-foreground/50" : ""}>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {strategy && (
            <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-primary mb-1.5">Strategic focus</div>
              <p className="text-[12px] font-semibold text-foreground">{strategy.theme}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{strategy.rationale}</p>
              {strategy.gaps.length > 0 && (
                <div className="mt-2.5">
                  <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/60 mb-1.5">Gaps to close</div>
                  <ul className="space-y-1">
                    {strategy.gaps.map((gap, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-foreground/70">
                        <AlertTriangle className="h-2.5 w-2.5 text-warning/70 mt-0.5 shrink-0" />
                        <span className="leading-relaxed">{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {strategy.costConstraints && strategy.costConstraints.length > 0 && (
                <div className="mt-2.5">
                  <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/60 mb-1.5">Cost guard rails</div>
                  <ul className="space-y-1">
                    {strategy.costConstraints.map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[10px] text-foreground/65">
                        <DollarSign className="h-2.5 w-2.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                        <span className="leading-relaxed">{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </OutputBlock>
      )}

      {/* ── Roadmap tab ────────────────────────────────────────────────────── */}
      {showRoadmap && roadmap.length > 0 && (
        <OutputBlock label="Roadmap" icon={Map}>
          <div className="space-y-2.5">
            {roadmap.map((phase, i) => (
              <div key={i} className="rounded-lg border border-border/60 bg-card p-3.5">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-primary font-medium">Phase {i + 1}</span>
                  {editingPhase === i ? (
                    <input
                      autoFocus
                      value={phase.name}
                      onChange={(e) => onUpdatePhase(i, "name", e.target.value)}
                      onBlur={() => onEditPhase(null)}
                      className="text-[12px] font-semibold bg-transparent border-b border-primary outline-none text-foreground"
                    />
                  ) : (
                    <h4 className="text-[12px] font-semibold text-foreground">{phase.name}</h4>
                  )}
                  <button type="button" onClick={() => onEditPhase(editingPhase === i ? null : i)} className="p-0.5 text-muted-foreground/30 hover:text-foreground transition-colors">
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                  {phase.costCategory && <CostBadge category={phase.costCategory} />}
                  {phase.durationWeeks !== undefined && (
                    <span className="font-mono text-[9px] text-muted-foreground/50">{phase.durationWeeks}w</span>
                  )}
                </div>
                {(phase.budgetMin !== undefined && phase.budgetMax !== undefined) && (
                  <div className="font-mono text-[10px] text-muted-foreground/60 mb-1.5">
                    ${phase.budgetMin.toLocaleString()}–${phase.budgetMax.toLocaleString()} budget
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground leading-relaxed">{phase.goal}</p>
                {phase.deliverables.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {phase.deliverables.map((d, j) => (
                      <li key={j} className="flex items-start gap-1.5 text-[11px] text-foreground/70 leading-relaxed">
                        <span className="text-muted-foreground/40 mt-0.5">·</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {phase.validationGates && phase.validationGates.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-border/30">
                    <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground/50 mb-1">Gates to proceed</div>
                    <ul className="space-y-0.5">
                      {phase.validationGates.map((gate, j) => (
                        <li key={j} className="flex items-start gap-1.5 text-[10px] text-foreground/65">
                          <CheckCircle2 className="h-2.5 w-2.5 text-success/60 mt-0.5 shrink-0" />
                          <span>{gate}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </OutputBlock>
      )}

      {/* Market signals — shown in overview */}
      {showOverview && competitors.length > 0 && (
        <OutputBlock label="Market Signals" icon={Users}>
          <div className="space-y-2">
            {competitors.map((c, i) => (
              <div key={i} className="rounded-lg border border-border/60 bg-card p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] font-semibold text-foreground">{c.name}</span>
                  <span className={`font-mono text-[9px] uppercase px-1.5 py-0.5 rounded border ${c.category === "direct" ? "border-destructive/30 text-destructive" : c.category === "indirect" ? "border-warning/30 text-warning" : "border-border text-muted-foreground"}`}>{c.category}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{c.differentiation}</p>
              </div>
            ))}
          </div>
        </OutputBlock>
      )}

      {showOverview && accuracyHistory.length > 1 && (
        <OutputBlock label="Accuracy Trend" icon={TrendingUp}>
          <AccuracySparkline values={accuracyHistory} />
        </OutputBlock>
      )}
    </div>
  );
}

function OutputBlock({ label, icon: Icon, children, copyText }: { label: string; icon: React.ElementType; children: React.ReactNode; copyText?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    if (!copyText) return;
    navigator.clipboard.writeText(copyText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon className="h-3 w-3 text-primary" />
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60 font-semibold">{label}</span>
        <div className="flex-1 h-px bg-border/50" />
        {copyText && (
          <button type="button" onClick={handleCopy} className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors" title="Copy to clipboard">
            {copied ? <Check className="h-2.5 w-2.5 text-success" /> : <Copy className="h-2.5 w-2.5" />}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

const STRICTNESS_OPTIONS: ReadonlyArray<{
  id: PredictionStrictness;
  label: string;
  hint: string;
  icon: React.ElementType;
}> = [
  { id: "conservative", label: "Conservative", hint: "Lower targets, higher confidence", icon: Shield },
  { id: "balanced",     label: "Balanced",     hint: "Honest uncertainty (default)",   icon: Crosshair },
  { id: "aggressive",   label: "Aggressive",   hint: "Stretch targets, lower confidence", icon: Rocket },
];

function StrictnessSelector({
  value,
  onChange,
  disabled,
}: {
  value: PredictionStrictness;
  onChange: (v: PredictionStrictness) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg border border-border p-1 bg-background">
      {STRICTNESS_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => !disabled && onChange(opt.id)}
            disabled={disabled}
            title={opt.hint}
            className={`flex flex-col items-center gap-0.5 py-1.5 rounded-md transition-all ${
              active ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:text-foreground"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Icon className="h-3 w-3" />
            <span className="font-mono text-[9px] font-medium">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ConfidenceExplanationPills({ items }: { items: ConfidenceExplanationItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/60">
        <Info className="h-2.5 w-2.5" />
        Confidence adjusted by
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => {
          const positive = item.delta > 0;
          const sign = positive ? "+" : "";
          const cls = positive ? "text-success" : "text-destructive";
          return (
            <li key={i} className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-foreground/75 leading-snug">{item.label}</span>
              <span className={`font-mono tabular-nums font-medium ${cls}`}>
                {sign}{item.delta}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CostBadge({ category }: { category: CostCategory }) {
  const cls =
    category === "LOW"
      ? "border-success/30 bg-success/10 text-success"
      : category === "MEDIUM"
      ? "border-warning/30 bg-warning/10 text-warning"
      : "border-destructive/30 bg-destructive/10 text-destructive";
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] font-medium ${cls}`}>
      {category}
    </span>
  );
}

function FactorBar({ label, value, weight }: { label: string; value: number; weight: string }) {
  const pct = Math.round((value / 10) * 100);
  const barCls = value >= 7 ? "bg-success/60" : value >= 4 ? "bg-warning/60" : "bg-destructive/60";
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] text-muted-foreground/60 leading-none">{label}</span>
        <span className="font-mono text-[9px] text-muted-foreground/35">{weight}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-[10px] tabular-nums text-foreground/70 w-5 text-right">{value.toFixed(1)}</span>
      </div>
    </div>
  );
}

function DecisionCard({ decision, expanded, onToggleExpand }: { decision: DecisionSuggestion; expanded?: boolean; onToggleExpand?: () => void }) {
  const priorityCls =
    decision.priority === "high"   ? "border-primary/30 bg-primary/10 text-primary" :
    decision.priority === "medium" ? "border-border bg-muted/30 text-muted-foreground" :
    "border-border/40 bg-transparent text-muted-foreground/60";

  return (
    <article className="rounded-lg border border-border/60 bg-card p-3.5 space-y-1.5 hover:border-border transition-colors">
      <header className="flex items-start justify-between gap-2">
        <h4 className="text-[12px] font-semibold text-foreground leading-snug">{decision.title}</h4>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {decision.costModel && <CostBadge category={decision.costModel.category} />}
          <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] font-medium ${priorityCls}`}>
            {decision.priority}
          </span>
        </div>
      </header>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{decision.summary || decision.justification}</p>
      <div className="flex gap-3 font-mono text-[10px] text-muted-foreground pt-0.5 flex-wrap">
        <span><span className="text-foreground font-medium tabular-nums">{decision.impact}</span> impact</span>
        <span><span className="text-foreground font-medium tabular-nums">{decision.effort}</span> effort</span>
        {typeof decision.confidence === "number" && (
          <span><span className="text-foreground font-medium tabular-nums">{decision.confidence}</span> conf.</span>
        )}
        {typeof decision.demand === "number" && (
          <span><span className="text-foreground font-medium tabular-nums">{decision.demand}</span> demand</span>
        )}
        {decision.costModel && (
          <span className="text-muted-foreground/50">~${decision.costModel.estimatedMonthly}/mo</span>
        )}
      </div>
      {decision.costModel?.scalingTrajectory && (
        <p className="text-[10px] text-muted-foreground/55 leading-relaxed italic">
          {decision.costModel.scalingTrajectory}
        </p>
      )}
      {decision.recommendation && (
        <div className="flex items-start gap-1.5 pt-1.5 border-t border-border/40">
          <Target className="h-2.5 w-2.5 mt-0.5 text-primary shrink-0" />
          <p className="text-[10px] text-foreground/75 leading-relaxed">{decision.recommendation}</p>
        </div>
      )}
      {/* item 7: expandable userStory + tradeoffs */}
      {(decision.userStory || decision.tradeoffs) && (
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/50 hover:text-foreground transition-colors pt-1"
        >
          {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
          {expanded ? "Less" : "More"}
        </button>
      )}
      {expanded && (
        <div className="pt-1.5 space-y-1.5 border-t border-border/30">
          {decision.userStory && (
            <div>
              <div className="font-mono text-[8px] uppercase tracking-[0.06em] text-muted-foreground/50 mb-0.5">User Story</div>
              <p className="text-[11px] text-foreground/70 leading-relaxed">{decision.userStory}</p>
            </div>
          )}
          {decision.tradeoffs && (
            <div>
              <div className="font-mono text-[8px] uppercase tracking-[0.06em] text-muted-foreground/50 mb-0.5">Tradeoffs</div>
              <p className="text-[11px] text-foreground/70 leading-relaxed">{decision.tradeoffs}</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ── DecisionTable (item 8) ────────────────────────────────────────────────────

function DecisionTable({ decisions }: { decisions: DecisionSuggestion[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-border/60">
            {["Decision", "Priority", "Impact", "Effort", "Conf.", "Demand"].map((h) => (
              <th key={h} className="text-left font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground/50 py-1.5 pr-3 last:pr-0">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {decisions.map((d, i) => (
            <tr key={i} className="hover:bg-muted/20 transition-colors">
              <td className="py-2 pr-3 font-medium text-foreground leading-snug max-w-[160px]">{d.title}</td>
              <td className="py-2 pr-3">
                <span className={`font-mono text-[9px] uppercase ${d.priority === "high" ? "text-primary" : d.priority === "medium" ? "text-foreground/60" : "text-muted-foreground/50"}`}>{d.priority}</span>
              </td>
              <td className="py-2 pr-3 font-mono tabular-nums text-foreground/80">{d.impact}</td>
              <td className="py-2 pr-3 font-mono tabular-nums text-foreground/80">{d.effort}</td>
              <td className="py-2 pr-3 font-mono tabular-nums text-foreground/80">{typeof d.confidence === "number" ? d.confidence : "—"}</td>
              <td className="py-2 font-mono tabular-nums text-foreground/80">{typeof d.demand === "number" ? d.demand : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── AccuracySparkline (item 9) ────────────────────────────────────────────────

function AccuracySparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 120; const h = 32; const pad = 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v / max) * (h - pad * 2));
    return `${x},${y}`;
  }).join(" ");
  const last = values[values.length - 1];
  return (
    <div className="flex items-center gap-3">
      <svg width={w} height={h} className="text-primary">
        <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="font-mono text-[11px]">
        <span className={`font-semibold ${last >= 0.5 ? "text-success" : "text-destructive"}`}>{Math.round(last * 100)}%</span>
        <span className="text-muted-foreground/50 ml-1">latest accuracy</span>
      </div>
    </div>
  );
}

// ── ExpectedOutcomeBlock ──────────────────────────────────────────────────────

function ExpectedOutcomeBlock({ outcome }: { outcome: PredictedOutcome }) {
  const confidencePct = Math.round(outcome.confidence * 100);
  const confidenceCls =
    outcome.confidence >= 0.7
      ? "text-success border-success/30 bg-success/10"
      : outcome.confidence >= 0.5
      ? "text-warning border-warning/30 bg-warning/10"
      : "text-destructive border-destructive/30 bg-destructive/10";

  const unit = outcome.unit ?? "";
  const baselineDisplay = outcome.baseline === null ? "?" : `${outcome.baseline}${unit}`;
  const targetDisplay = `${outcome.target}${unit}`;

  return (
    <section className="rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
      <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-primary font-medium">Expected outcome</span>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium ${confidenceCls}`}>
          <Activity className="h-2.5 w-2.5" />
          {confidencePct}% confidence
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-2 flex-wrap">
        <h4 className="text-[14px] font-semibold text-foreground leading-tight">{outcome.metric}</h4>
      </div>
      <div className="flex items-center gap-2 mb-2 font-mono text-[12px] tabular-nums">
        <span className="text-muted-foreground">{baselineDisplay}</span>
        <span className="text-muted-foreground/40">→</span>
        <span className="text-foreground font-semibold">{targetDisplay}</span>
        <span className="text-muted-foreground/50 text-[11px] ml-1">in {outcome.timeframeDays} days</span>
      </div>
      {outcome.rationale && (
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{outcome.rationale}</p>
      )}
    </section>
  );
}

// ── VerdictBlock ──────────────────────────────────────────────────────────────

const verdictStyles: Record<VerdictLabel, {
  icon: React.ElementType;
  label: string;
  cardCls: string;
  pillCls: string;
  iconCls: string;
}> = {
  PROCEED: {
    icon: ShieldCheck, label: "Proceed",
    cardCls: "border-success/30 bg-success/[0.06]",
    pillCls: "bg-success/15 text-success border-success/30",
    iconCls: "text-success",
  },
  VALIDATE_FIRST: {
    icon: ShieldAlert, label: "Validate first",
    cardCls: "border-warning/40 bg-warning/5",
    pillCls: "bg-warning/15 text-warning border-warning/30",
    iconCls: "text-warning",
  },
  DO_NOT_BUILD: {
    icon: ShieldX, label: "Don't build yet",
    cardCls: "border-destructive/40 bg-destructive/5",
    pillCls: "bg-destructive/15 text-destructive border-destructive/30",
    iconCls: "text-destructive",
  },
};

function VerdictBlock({ verdict }: { verdict: Verdict }) {
  const style = verdictStyles[verdict.label];
  const Icon = style.icon;
  const factors = verdict.factors as VerdictFactors | undefined;
  return (
    <section className={`rounded-xl border-2 p-4 ${style.cardCls}`}>
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-foreground/40 mb-2.5">Final verdict</div>
      <div className="flex items-center gap-3 mb-2.5 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold ${style.pillCls}`}>
          <Icon className={`h-3.5 w-3.5 ${style.iconCls}`} />
          {style.label}
        </span>
        <div className="font-mono text-[10px] text-muted-foreground tabular-nums flex items-center gap-1.5">
          {verdict.compositeScore !== undefined ? (
            <>
              <span className="font-semibold text-foreground">{verdict.compositeScore.toFixed(1)}</span>
              <span>/10 composite</span>
            </>
          ) : (
            <span>{verdict.averageConfidence.toFixed(1)}/10 confidence</span>
          )}
        </div>
      </div>
      {factors && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 p-3 rounded-lg bg-background/50 border border-border/30">
          <FactorBar label="Confidence" value={factors.confidence} weight="40%" />
          <FactorBar label="Cost Viability" value={factors.costViability} weight="30%" />
          <FactorBar label="Demand Signal" value={factors.demandSignal} weight="20%" />
          <FactorBar label="Strategic Fit" value={factors.strategicFit} weight="10%" />
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-foreground/80">
        <span className="font-semibold">Reason: </span>{verdict.reason}
      </p>
    </section>
  );
}
