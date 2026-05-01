"use client";

import React from "react";
import {
  Bot, Send, Loader2, Sparkles, StopCircle, Zap, Brain,
  Target, AlertTriangle, CheckCircle2, Lightbulb, Map,
  Compass, Flame, ShieldAlert, ShieldCheck, ShieldX,
  RotateCcw, FileText, ListTodo, Save, Cpu, HelpCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  runAutonomousAgent,
  type AgentEvent,
  type AgentDepth,
  type AgentState,
} from "@/lib/ai/autonomousAgent";
import type {
  DecisionSuggestion,
  StrategicGuidance,
  RoadmapPhase,
  ClarifyingQuestion,
} from "@/lib/ai/actions";
import type { Verdict, VerdictLabel } from "@/lib/ai/verdict";
import { saveDecision } from "@/lib/firebase/db";
import { generatePRDAction, suggestTasksAction, textToTipTap } from "@/lib/ai/actions";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToastStore";
import { activity } from "@/store/useActivityStore";

// ── Types ─────────────────────────────────────────────────────────────────────

type ChatEntryInput =
  | { kind: "user"; text: string }
  | { kind: "thinking"; text: string; state?: AgentState }
  | { kind: "question"; question: ClarifyingQuestion }
  | { kind: "system"; text: string }
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
  { label: "Building argument",  sublabel: "Scoring & strategy",       states: ["evaluate_decisions", "validation_layer", "confidence_gate", "strategy_generation"] },
  { label: "Generating verdict", sublabel: "Roadmap & final output",   states: ["roadmap_generation", "output"] },
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
  const { setActiveView, currentDocId } = useAppStore();
  const [idea, setIdea] = React.useState("");
  const [depth, setDepth] = React.useState<AgentDepth>("standard");
  const [chat, setChat] = React.useState<ChatEntry[]>([]);
  const [agentState, setAgentState] = React.useState<AgentState>("idle");
  const [decisions, setDecisions] = React.useState<DecisionSuggestion[]>([]);
  const [strategy, setStrategy] = React.useState<StrategicGuidance | null>(null);
  const [roadmap, setRoadmap] = React.useState<RoadmapPhase[]>([]);
  const [topDecision, setTopDecision] = React.useState<DecisionSuggestion | null>(null);
  const [assumptions, setAssumptions] = React.useState<string[]>([]);
  const [verdict, setVerdict] = React.useState<Verdict | null>(null);
  const [pastIdeas, setPastIdeas] = React.useState<string[]>([]);
  const [pendingQuestion, setPendingQuestion] = React.useState<ClarifyingQuestion | null>(null);
  const [answerText, setAnswerText] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [isConvertingToSpec, setIsConvertingToSpec] = React.useState(false);
  const [isCreatingTasks, setIsCreatingTasks] = React.useState(false);

  const isRunning = agentState !== "idle" && agentState !== "stopped" && agentState !== "error" && agentState !== "output";
  const isDone = agentState === "output";

  const abortRef = React.useRef<AbortController | null>(null);
  const answerResolverRef = React.useRef<((value: string) => void) | null>(null);
  const answerRejecterRef = React.useRef<((reason: Error) => void) | null>(null);
  const chatScrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat]);

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
        appendEntry({ kind: "system", text: `Generated ${event.decisions.length} decisions.` });
        break;
      case "strategy":
        setStrategy(event.strategy);
        appendEntry({ kind: "system", text: `Strategic theme: "${event.strategy.theme}"` });
        break;
      case "roadmap":
        setRoadmap(event.roadmap);
        appendEntry({ kind: "system", text: `Drafted a ${event.roadmap.length}-phase roadmap.` });
        break;
      case "topDecision":
        setTopDecision(event.decision);
        break;
      case "assumptions":
        setAssumptions(event.assumptions);
        appendEntry({ kind: "system", text: `Surfaced ${event.assumptions.length} hidden assumption${event.assumptions.length === 1 ? "" : "s"}.` });
        break;
      case "verdict":
        setVerdict(event.verdict);
        break;
      case "memoryLoaded":
        setPastIdeas(event.pastIdeas);
        break;
      case "error":
        appendEntry({ kind: "error", text: event.message });
        break;
      case "done":
        appendEntry({ kind: "system", text: "Run complete." });
        break;
    }
  }, [appendEntry]);

  const start = React.useCallback(async () => {
    const trimmed = idea.trim();
    if (!trimmed || isRunning) return;

    setChat([]);
    setDecisions([]);
    setStrategy(null);
    setRoadmap([]);
    setTopDecision(null);
    setAssumptions([]);
    setVerdict(null);
    setPastIdeas([]);
    setPendingQuestion(null);
    setAnswerText("");
    setAgentState("understand_idea");
    appendEntry({ kind: "user", text: trimmed });

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
  }, [idea, depth, isRunning, appendEntry, handleAgentEvent, user?.uid]);

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
    setPastIdeas([]);
    setPendingQuestion(null);
    setAnswerText("");
    setAgentState("idle");
  }, [isRunning, stop]);

  const handleSaveDecision = React.useCallback(async () => {
    if (!user || !topDecision || isSaving) return;
    setIsSaving(true);
    try {
      await saveDecision(user.uid, {
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
        sourceDocId: currentDocId ?? undefined,
      });
      toast.success("Decision saved", topDecision.title);
      activity.success("Decision saved from Autonomous Mode");
    } catch {
      toast.error("Failed to save decision");
    } finally {
      setIsSaving(false);
    }
  }, [user, topDecision, strategy, isSaving, currentDocId]);

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
        currentDocId ?? undefined,
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
        currentDocId ?? undefined,
      );
      toast.success("Tasks created", `${tasks.length} task${tasks.length === 1 ? "" : "s"} added to your board`);
      setActiveView("tasks");
    } catch {
      toast.error("Failed to create tasks", "Check your API config and try again.");
    } finally {
      setIsCreatingTasks(false);
    }
  }, [user, topDecision, strategy, roadmap, decisions, isCreatingTasks, currentDocId, setActiveView]);

  const activeStep = getActiveStep(agentState);
  const hasOutput = decisions.length > 0 || !!strategy || roadmap.length > 0 || !!verdict;

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

      {/* ── Three-panel body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: Command input + mode cards + stepper */}
        <aside className="w-[272px] shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto custom-scrollbar">
          <div className="p-5 flex flex-col gap-5">

            {/* Command input */}
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60">
                What do you want to build?
              </label>
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
              <p className="font-mono text-[9px] text-muted-foreground/35">⌘↵ to run</p>
            </div>

            {/* Mode cards */}
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60">
                Depth
              </label>
              <div className="space-y-1.5">
                {depthOptions.map((opt) => {
                  const Icon = opt.icon;
                  const active = depth === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => !isRunning && setDepth(opt.id)}
                      disabled={isRunning}
                      title={opt.hint}
                      className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                        active
                          ? "border-primary/40 bg-primary/[0.07]"
                          : "border-border bg-background hover:bg-muted/40 hover:border-border/80"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground/50"}`} />
                      <div className="min-w-0 flex-1">
                        <div className={`font-mono text-[11px] font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground/60 leading-snug mt-0.5">{opt.description}</div>
                      </div>
                      {active && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Analyze button */}
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
          </div>
        </aside>

        {/* CENTER: Agent stream */}
        <section className="flex flex-col border-r border-border overflow-hidden" style={{ width: "340px", flexShrink: 0 }}>
          <div className="px-4 py-2.5 border-b border-border shrink-0">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/50">Agent stream</span>
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

            {chat.map((entry) => (
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

          {/* Q&A answer box */}
          {pendingQuestion && (
            <div className="border-t border-border p-3 bg-primary/[0.04] shrink-0">
              <div className="flex items-start gap-2 mb-2.5">
                <HelpCircle className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-foreground/80 leading-relaxed">
                  {pendingQuestion.why ?? "Your answer is needed to proceed."}
                </p>
              </div>
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
        <section className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-2.5 border-b border-border shrink-0 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/50">Intelligence output</span>
            {isDone && (
              <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-success font-medium">Complete</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {!hasOutput && !isRunning ? (
              <OutputSkeleton />
            ) : (
              <OutputPanel
                decisions={decisions}
                strategy={strategy}
                roadmap={roadmap}
                topDecision={topDecision}
                assumptions={assumptions}
                verdict={verdict}
                isRunning={isRunning}
                depth={depth}
              />
            )}
          </div>

          {/* Action buttons once complete */}
          {isDone && (
            <div className="border-t border-border p-4 shrink-0 bg-card">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/50 mr-1">Actions</span>
                <button
                  onClick={handleSaveDecision}
                  disabled={!topDecision || isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] font-mono text-[11px] font-medium border border-border bg-card text-foreground hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  {isSaving ? "Saving…" : "Save Decision"}
                </button>
                <button
                  onClick={handleConvertToSpec}
                  disabled={!topDecision || isConvertingToSpec}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] font-mono text-[11px] font-medium border border-border bg-card text-foreground hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isConvertingToSpec ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                  {isConvertingToSpec ? "Creating spec…" : "Convert to Spec"}
                </button>
                <button
                  onClick={handleCreateTasks}
                  disabled={!topDecision || isCreatingTasks}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] font-mono text-[11px] font-medium border border-border bg-card text-foreground hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isCreatingTasks ? <Loader2 className="h-3 w-3 animate-spin" /> : <ListTodo className="h-3 w-3" />}
                  {isCreatingTasks ? "Creating tasks…" : "Create Tasks"}
                </button>
              </div>
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
      <div className="rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-2.5">
        <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-primary/50 mb-1">Idea</div>
        <p className="text-[12px] leading-relaxed text-foreground">{entry.text}</p>
      </div>
    );
  }
  if (entry.kind === "thinking") {
    return (
      <div className="flex items-start gap-2">
        <Brain className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/35" />
        <p className="text-[11px] text-muted-foreground/65 leading-relaxed italic">{entry.text}</p>
      </div>
    );
  }
  if (entry.kind === "question") {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <HelpCircle className="h-3 w-3 text-primary" />
          <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-primary font-semibold">Clarification needed</span>
        </div>
        <p className="text-[12px] font-medium text-foreground leading-relaxed">→ {entry.question.question}</p>
        {entry.question.why && (
          <p className="text-[10px] text-muted-foreground/70 mt-1.5 leading-relaxed">{entry.question.why}</p>
        )}
      </div>
    );
  }
  if (entry.kind === "system") {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-2.5 w-2.5 text-success shrink-0" />
        <span className="font-mono text-[10px] text-muted-foreground/55">{entry.text}</span>
      </div>
    );
  }
  return (
    <div className="rounded-md border-l-2 border-l-destructive bg-destructive/[0.05] px-3 py-2">
      <span className="font-mono text-[10px] text-destructive font-semibold">Error: </span>
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
  isRunning: boolean;
  depth: AgentDepth;
}

function OutputPanel({ decisions, strategy, roadmap, topDecision, assumptions, verdict, isRunning, depth }: OutputPanelProps) {
  return (
    <div className="p-6 space-y-5 max-w-2xl">

      {/* Top decision summary card */}
      {topDecision && (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] to-transparent p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-2">
            <Flame className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-primary font-medium">Critical decision</span>
          </div>
          <h3 className="text-[13px] font-semibold text-foreground leading-snug">{topDecision.title}</h3>
          {topDecision.keyInsight && (
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-1.5">{topDecision.keyInsight}</p>
          )}
          {topDecision.recommendation && (
            <div className="flex items-start gap-1.5 mt-2.5 pt-2.5 border-t border-primary/15">
              <Target className="h-3 w-3 text-primary mt-0.5 shrink-0" />
              <p className="text-[11px] text-foreground/80 leading-relaxed">{topDecision.recommendation}</p>
            </div>
          )}
        </div>
      )}

      {/* Final verdict */}
      {verdict && <VerdictBlock verdict={verdict} />}

      {/* Evidence block */}
      {decisions.length > 0 && (
        <OutputBlock label="Evidence" icon={Compass}>
          <div className="space-y-2.5">
            {decisions.map((d, i) => (
              <DecisionCard key={`${d.title}-${i}`} decision={d} />
            ))}
          </div>
        </OutputBlock>
      )}

      {/* Key insights */}
      {decisions.some((d) => d.keyInsight) && (
        <OutputBlock label="Insights" icon={Lightbulb}>
          <ul className="space-y-2">
            {decisions.filter((d) => d.keyInsight).map((d, i) => (
              <li key={i} className="rounded-lg border border-destructive/15 bg-destructive/[0.04] px-3 py-2.5">
                <span className="font-mono text-[10px] font-semibold text-destructive">{d.title}: </span>
                <span className="text-[11px] text-foreground/80 leading-relaxed">{d.keyInsight}</span>
              </li>
            ))}
          </ul>
        </OutputBlock>
      )}

      {/* Argument block */}
      {(assumptions.length > 0 || strategy) && (
        <OutputBlock label="Argument" icon={Brain}>
          {assumptions.length > 0 && (
            <div className="rounded-lg border border-warning/25 bg-warning/[0.05] p-3 mb-2.5">
              <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-warning mb-2">Hidden assumptions</div>
              <ul className="space-y-1.5">
                {assumptions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-foreground/80 leading-relaxed">
                    <AlertTriangle className="h-2.5 w-2.5 text-warning/80 mt-0.5 shrink-0" />
                    <span>{a}</span>
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
            </div>
          )}
        </OutputBlock>
      )}

      {/* Roadmap */}
      {roadmap.length > 0 && (
        <OutputBlock label="Roadmap" icon={Map}>
          <div className="space-y-2.5">
            {roadmap.map((phase, i) => (
              <div key={i} className="rounded-lg border border-border/60 bg-card p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-primary font-medium">Phase {i + 1}</span>
                  <h4 className="text-[12px] font-semibold text-foreground">{phase.name}</h4>
                </div>
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
              </div>
            ))}
          </div>
        </OutputBlock>
      )}

      {!isRunning && depth === "quick" && roadmap.length === 0 && decisions.length > 0 && (
        <p className="font-mono text-[10px] text-muted-foreground/45 italic">
          Quick mode skipped the roadmap. Switch to Standard or Deep for a full plan.
        </p>
      )}
    </div>
  );
}

function OutputBlock({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon className="h-3 w-3 text-primary" />
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60 font-semibold">{label}</span>
        <div className="flex-1 h-px bg-border/50" />
      </div>
      {children}
    </section>
  );
}

function DecisionCard({ decision }: { decision: DecisionSuggestion }) {
  const priorityCls =
    decision.priority === "high"   ? "border-primary/30 bg-primary/10 text-primary" :
    decision.priority === "medium" ? "border-border bg-muted/30 text-muted-foreground" :
    "border-border/40 bg-transparent text-muted-foreground/60";

  return (
    <article className="rounded-lg border border-border/60 bg-card p-3.5 space-y-1.5 hover:border-border transition-colors">
      <header className="flex items-start justify-between gap-2">
        <h4 className="text-[12px] font-semibold text-foreground leading-snug">{decision.title}</h4>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] font-medium ${priorityCls}`}>
          {decision.priority}
        </span>
      </header>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{decision.summary || decision.justification}</p>
      <div className="flex gap-3 font-mono text-[10px] text-muted-foreground pt-0.5">
        <span><span className="text-foreground font-medium tabular-nums">{decision.impact}</span> impact</span>
        <span><span className="text-foreground font-medium tabular-nums">{decision.effort}</span> effort</span>
        {typeof decision.confidence === "number" && (
          <span><span className="text-foreground font-medium tabular-nums">{decision.confidence}</span> conf.</span>
        )}
      </div>
      {decision.recommendation && (
        <div className="flex items-start gap-1.5 pt-1.5 border-t border-border/40">
          <Target className="h-2.5 w-2.5 mt-0.5 text-primary shrink-0" />
          <p className="text-[10px] text-foreground/75 leading-relaxed">{decision.recommendation}</p>
        </div>
      )}
    </article>
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
  return (
    <section className={`rounded-xl border-2 p-4 ${style.cardCls}`}>
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-foreground/40 mb-2.5">Final verdict</div>
      <div className="flex items-center gap-3 mb-2.5">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold ${style.pillCls}`}>
          <Icon className={`h-3.5 w-3.5 ${style.iconCls}`} />
          {style.label}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
          {verdict.averageConfidence.toFixed(1)}/10 confidence
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-foreground/80">
        <span className="font-semibold">Reason: </span>{verdict.reason}
      </p>
    </section>
  );
}
