"use client";

import React from "react";
import { Bot, Send, Loader2, Sparkles, StopCircle, Zap, Brain, Target, AlertTriangle, CheckCircle2, Lightbulb, Map, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type ChatEntryInput =
  | { kind: "user"; text: string }
  | { kind: "thinking"; text: string; state?: AgentState }
  | { kind: "question"; question: ClarifyingQuestion }
  | { kind: "system"; text: string }
  | { kind: "error"; text: string };

type ChatEntry = ChatEntryInput & { id: string };

const depthOptions: ReadonlyArray<{ id: AgentDepth; label: string; hint: string }> = [
  { id: "quick", label: "Quick", hint: "Skip clarifications + roadmap" },
  { id: "standard", label: "Standard", hint: "1 clarification, full output" },
  { id: "deep", label: "Deep", hint: "2 clarifications, confidence gate" },
];

let entryCounter = 0;
const nextEntryId = () => `entry-${++entryCounter}`;

export function AutonomousModeView() {
  const [idea, setIdea] = React.useState("");
  const [depth, setDepth] = React.useState<AgentDepth>("standard");
  const [chat, setChat] = React.useState<ChatEntry[]>([]);
  const [agentState, setAgentState] = React.useState<AgentState>("idle");
  const [decisions, setDecisions] = React.useState<DecisionSuggestion[]>([]);
  const [strategy, setStrategy] = React.useState<StrategicGuidance | null>(null);
  const [roadmap, setRoadmap] = React.useState<RoadmapPhase[]>([]);
  const [pendingQuestion, setPendingQuestion] = React.useState<ClarifyingQuestion | null>(null);
  const [answerText, setAnswerText] = React.useState("");
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

  const handleAgentEvent = React.useCallback(
    (event: AgentEvent) => {
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
        case "error":
          appendEntry({ kind: "error", text: event.message });
          break;
        case "done":
          appendEntry({ kind: "system", text: "Run complete." });
          break;
      }
    },
    [appendEntry]
  );

  const start = React.useCallback(async () => {
    const trimmed = idea.trim();
    if (!trimmed || isRunning) return;

    setChat([]);
    setDecisions([]);
    setStrategy(null);
    setRoadmap([]);
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
        awaitUserResponse: (question) =>
          new Promise<string>((resolve, reject) => {
            answerResolverRef.current = resolve;
            answerRejecterRef.current = reject;
            // Surface the question in case the orchestrator asks before the
            // event handler renders it (defensive).
            setPendingQuestion(question);
          }),
      });
    } finally {
      abortRef.current = null;
      answerResolverRef.current = null;
      answerRejecterRef.current = null;
    }
  }, [idea, depth, isRunning, appendEntry, handleAgentEvent]);

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
    setPendingQuestion(null);
    setAnswerText("");
    setAgentState("idle");
  }, [isRunning, stop]);

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex items-center justify-between px-8 h-14 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Autonomous Mode</span>
          <AgentStatePill state={agentState} />
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={stop}>
              <StopCircle className="mr-1.5 h-3.5 w-3.5" />
              Stop
            </Button>
          )}
          {(isDone || agentState === "stopped" || agentState === "error") && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={reset}>
              New run
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        <section className="flex flex-col border-r border-border/60 overflow-hidden">
          <div className="p-6 border-b border-border/60 space-y-3 shrink-0">
            <label className="text-[10px] uppercase tracking-[0.06em] font-medium text-muted-foreground">
              Product Idea
            </label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Describe your product idea — e.g. 'Build an app for students to manage expenses'"
              className="w-full min-h-[80px] rounded-lg border border-border/60 bg-white px-3 py-2 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              disabled={isRunning || pendingQuestion !== null}
            />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1 rounded-full border border-border/60 bg-white p-1 shadow-sm">
                {depthOptions.map((opt) => {
                  const active = depth === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => !isRunning && setDepth(opt.id)}
                      disabled={isRunning}
                      title={opt.hint}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      } ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <Button
                size="sm"
                onClick={start}
                disabled={!idea.trim() || isRunning}
                className="text-xs"
              >
                {isRunning ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                Start Autonomous Mode
              </Button>
            </div>
          </div>

          <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3 custom-scrollbar">
            {chat.length === 0 && !isRunning && (
              <div className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground/70">
                <Bot className="h-8 w-8 mb-3 opacity-50" />
                <p className="text-sm font-medium">Drop in an idea to start.</p>
                <p className="text-xs mt-1 max-w-xs">
                  Buildcase will think through it stage by stage and ask only when something critical is missing.
                </p>
              </div>
            )}

            {chat.map((entry) => (
              <ChatBubble key={entry.id} entry={entry} />
            ))}

            {isRunning && agentState !== "awaiting_user" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 pl-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Working…</span>
              </div>
            )}
          </div>

          {pendingQuestion && (
            <div className="border-t border-border/60 p-4 bg-amber-50/40 dark:bg-amber-500/5 shrink-0">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                  <span className="font-semibold">Needs clarification:</span> {pendingQuestion.why}
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Your answer…"
                  className="flex-1 h-9 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitAnswer();
                    }
                  }}
                  autoFocus
                />
                <Button size="sm" onClick={submitAnswer} disabled={!answerText.trim()} className="text-xs">
                  <Send className="mr-1 h-3 w-3" />
                  Send
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className="flex-1 overflow-y-auto bg-muted/10 custom-scrollbar">
          <StructuredOutput
            decisions={decisions}
            strategy={strategy}
            roadmap={roadmap}
            isRunning={isRunning}
            depth={depth}
          />
        </section>
      </div>
    </div>
  );
}

function AgentStatePill({ state }: { state: AgentState }) {
  if (state === "idle") return null;
  const tone =
    state === "error"
      ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
      : state === "stopped"
        ? "border-border bg-muted text-muted-foreground"
        : state === "output"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : state === "awaiting_user"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-primary/20 bg-primary/10 text-primary";
  const label =
    state === "output"
      ? "Done"
      : state === "stopped"
        ? "Stopped"
        : state === "error"
          ? "Error"
          : state === "awaiting_user"
            ? "Awaiting answer"
            : "Running";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}>
      <span className="h-1 w-1 rounded-full bg-current animate-pulse" />
      {label}
    </span>
  );
}

function ChatBubble({ entry }: { entry: ChatEntry }) {
  if (entry.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-3.5 py-2 text-sm leading-relaxed shadow-sm">
          {entry.text}
        </div>
      </div>
    );
  }
  if (entry.kind === "thinking") {
    return (
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Brain className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
        <p className="leading-relaxed italic">{entry.text}</p>
      </div>
    );
  }
  if (entry.kind === "question") {
    return (
      <div className="rounded-2xl rounded-bl-md border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm leading-relaxed">
        <div className="text-[10px] uppercase tracking-[0.06em] font-semibold text-amber-700 dark:text-amber-300 mb-1.5">
          Clarifying question
        </div>
        <p className="text-foreground">{entry.question.question}</p>
        {entry.question.why && (
          <p className="mt-1.5 text-xs text-muted-foreground">→ {entry.question.why}</p>
        )}
      </div>
    );
  }
  if (entry.kind === "system") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        <span>{entry.text}</span>
      </div>
    );
  }
  return (
    <div className="rounded-md border-l-2 border-l-red-500 bg-red-500/[0.06] px-3 py-2 text-xs text-red-800 dark:text-red-200 leading-relaxed">
      <span className="font-semibold">Error:</span> {entry.text}
    </div>
  );
}

interface StructuredOutputProps {
  decisions: DecisionSuggestion[];
  strategy: StrategicGuidance | null;
  roadmap: RoadmapPhase[];
  isRunning: boolean;
  depth: AgentDepth;
}

function StructuredOutput({ decisions, strategy, roadmap, isRunning, depth }: StructuredOutputProps) {
  const empty = decisions.length === 0 && !strategy && roadmap.length === 0;
  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 text-muted-foreground/70">
        <Zap className="h-8 w-8 mb-3 opacity-40" />
        <p className="text-sm font-medium">Structured output appears here as the agent works.</p>
        <p className="text-xs mt-1 max-w-xs">
          Decisions, strategy, and roadmap stream in stage by stage.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      {decisions.length > 0 && (
        <SectionBlock icon={Compass} title="Decisions">
          <div className="space-y-3">
            {decisions.map((d, i) => (
              <DecisionPreview key={`${d.title}-${i}`} decision={d} />
            ))}
          </div>
        </SectionBlock>
      )}

      {decisions.some((d) => d.keyInsight) && (
        <SectionBlock icon={Lightbulb} title="Key Insights">
          <ul className="space-y-2">
            {decisions
              .filter((d) => d.keyInsight)
              .map((d, i) => (
                <li key={i} className="rounded-lg border border-red-500/20 bg-red-500/[0.04] p-3 text-sm leading-relaxed text-red-900/90 dark:text-red-100/90">
                  <span className="font-medium text-red-700 dark:text-red-300">{d.title}:</span>{" "}
                  {d.keyInsight}
                </li>
              ))}
          </ul>
        </SectionBlock>
      )}

      {strategy && (
        <SectionBlock icon={Target} title="Strategic Focus">
          <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">{strategy.theme}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{strategy.rationale}</p>
            {strategy.gaps.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground mb-1.5">Gaps to close</p>
                <ul className="space-y-1">
                  {strategy.gaps.map((gap, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground/85">
                      <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                      <span>{gap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SectionBlock>
      )}

      {roadmap.length > 0 && (
        <SectionBlock icon={Map} title="Roadmap">
          <div className="space-y-3">
            {roadmap.map((phase, i) => (
              <div key={i} className="rounded-lg border border-border/60 bg-white p-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-[0.06em] font-semibold text-primary">Phase {i + 1}</span>
                  <h4 className="text-sm font-semibold text-foreground">{phase.name}</h4>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{phase.goal}</p>
                {phase.deliverables.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {phase.deliverables.map((d, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-foreground/85">
                        <span className="text-muted-foreground/60 mt-0.5">•</span>
                        <span className="leading-relaxed">{d}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </SectionBlock>
      )}

      {!isRunning && depth === "quick" && roadmap.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Quick mode skipped the roadmap. Switch to Standard or Deep for a full plan.
        </p>
      )}
    </div>
  );
}

function SectionBlock({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section>
      <header className="flex items-center gap-2 mb-3">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs uppercase tracking-[0.06em] font-semibold text-foreground">{title}</h3>
      </header>
      {children}
    </section>
  );
}

function DecisionPreview({ decision }: { decision: DecisionSuggestion }) {
  const priorityCls =
    decision.priority === "high"
      ? "border-primary/30 bg-primary/10 text-primary"
      : decision.priority === "medium"
        ? "border-border bg-muted/30 text-muted-foreground"
        : "border-border/40 bg-transparent text-muted-foreground/70";

  return (
    <article className="rounded-lg border border-border/60 bg-white p-4 space-y-2">
      <header className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground leading-snug">{decision.title}</h4>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] font-medium ${priorityCls}`}>
          {decision.priority}
        </span>
      </header>
      <p className="text-xs text-muted-foreground leading-relaxed">{decision.summary || decision.justification}</p>
      <div className="flex gap-3 text-[10px] text-muted-foreground pt-1">
        <span><span className="font-mono tabular-nums text-foreground">{decision.impact}</span> impact</span>
        <span><span className="font-mono tabular-nums text-foreground">{decision.effort}</span> effort</span>
      </div>
      {decision.recommendation && (
        <div className="flex items-start gap-1.5 text-xs pt-1 border-t border-border/40 mt-2">
          <Target className="h-3 w-3 mt-0.5 text-primary shrink-0" />
          <p className="text-foreground/85 leading-relaxed">{decision.recommendation}</p>
        </div>
      )}
    </article>
  );
}

