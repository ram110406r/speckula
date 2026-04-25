"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { X, Sparkles, Wand2, Lightbulb, Send, Loader2, CheckSquare, AlertTriangle, Plus, Clock3 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  analyzeThinkingSignalsAction,
  generateFeatureFromInsightAction,
  generatePRDFromDecisionAction,
  type ProactiveInsight,
  type ProactiveThinkingSignals,
} from "@/lib/ai/actions";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AIPanel() {
  const {
    toggleAiPanel,
    activeContext,
    currentDocId,
    dismissedHintsByDoc,
    dismissHintForDoc,
    setPendingInsertion,
   setPendingDecisionForPRD,
  } = useAppStore();
  const { user } = useAuth();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [showDetailedSignals, setShowDetailedSignals] = React.useState(false);
  const [signals, setSignals] = React.useState<ProactiveThinkingSignals>({ insights: [], suggestions: [], challenges: [] });
  const [featureDrafts, setFeatureDrafts] = React.useState<Record<string, string>>({});
  const [isGeneratingFeatureId, setIsGeneratingFeatureId] = React.useState<string | null>(null);
    const [isGeneratingPRDFromDecision, setIsGeneratingPRDFromDecision] = React.useState<string | null>(null);
  const lastAnalyzedRef = React.useRef("");
  const lastAnalyzedAtRef = React.useRef(0);
  const analyzeTimerRef = React.useRef<number | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const streamAbortRef = React.useRef<AbortController | null>(null);
  const isMountedRef = React.useRef(true);
  const messageIdRef = React.useRef(0);
  const nextMessageId = React.useCallback(() => `msg-${++messageIdRef.current}`, []);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      streamAbortRef.current?.abort();
    };
  }, []);

  const ANALYZE_DEBOUNCE_MS = 4000;
  const ANALYZE_COOLDOWN_MS = 12000;
  const MAX_CONTEXT_CHARS = 6000;

  const hashContent = (value: string) => value.trim().replace(/\s+/g, " ");

  const dismissed = React.useMemo(() => {
    if (!currentDocId) return new Set<string>();
    return new Set(dismissedHintsByDoc[currentDocId] ?? []);
  }, [currentDocId, dismissedHintsByDoc]);

  const currentUnderstanding = React.useMemo(() => {
    const trimmed = activeContext.trim();
    if (!trimmed) return "Start your first product decision. Describe your idea in one sentence.";
    if (trimmed.length <= 180) return trimmed;
    return `${trimmed.slice(0, 180)}...`;
  }, [activeContext]);

  const repeatedPatternInsight = React.useMemo(() => {
    const terms = activeContext
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 4 && !["about", "there", "their", "which", "would", "could", "should", "while", "where", "after"].includes(word));

    const counts = new Map<string, number>();
    terms.forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
    const repeated = [...counts.entries()].sort((left, right) => right[1] - left[1]).find((item) => item[1] >= 3);
    if (!repeated) return null;

    return `You mentioned \"${repeated[0]}\" multiple times. This may be your core problem.`;
  }, [activeContext]);

  const weakProblemSignal = React.useMemo(() => {
    const normalized = activeContext.toLowerCase();
    if (normalized.length < 80) return null;
    const hasSpecificSignal = /(who|metric|drop|retention|conversion|churn|activation|behavior|cohort|timeframe)/.test(normalized);
    if (hasSpecificSignal) return null;
    return "Weak problem definition detected. Ask: Who? What behavior? What metric?";
  }, [activeContext]);

  const signalCount = signals.insights.length + signals.suggestions.length + signals.challenges.length + (signals.decisions?.length ?? 0);

  React.useEffect(() => {
    setMessages([]);
    setInput("");
    setSignals({ insights: [], suggestions: [], challenges: [] });
    setShowDetailedSignals(false);
    setFeatureDrafts({});
    setIsLoading(false);
    setIsAnalyzing(false);
    setIsGeneratingFeatureId(null);
    setIsGeneratingPRDFromDecision(null);
    lastAnalyzedRef.current = "";
    lastAnalyzedAtRef.current = 0;

    if (analyzeTimerRef.current) {
      window.clearTimeout(analyzeTimerRef.current);
      analyzeTimerRef.current = null;
    }
  }, [currentDocId]);

  React.useEffect(() => {
    const normalized = hashContent(activeContext);

    if (!user || normalized.length < 120) {
      return;
    }

    if (normalized === lastAnalyzedRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastAnalyzedAtRef.current < ANALYZE_COOLDOWN_MS) {
      return;
    }

    if (analyzeTimerRef.current) {
      window.clearTimeout(analyzeTimerRef.current);
    }

    analyzeTimerRef.current = window.setTimeout(async () => {
      setIsAnalyzing(true);
      try {
        const boundedContext = activeContext.length > MAX_CONTEXT_CHARS
          ? activeContext.slice(-MAX_CONTEXT_CHARS)
          : activeContext;
        const data = await analyzeThinkingSignalsAction(boundedContext);
        setSignals(data);
        lastAnalyzedRef.current = normalized;
        lastAnalyzedAtRef.current = Date.now();
      } catch (error) {
        console.error("Proactive analysis failed:", error);
      } finally {
        setIsAnalyzing(false);
      }
    }, ANALYZE_DEBOUNCE_MS);

    return () => {
      if (analyzeTimerRef.current) {
        window.clearTimeout(analyzeTimerRef.current);
      }
    };
  }, [activeContext, user]);

  const dismissHint = (id: string) => {
    if (!currentDocId) return;
    dismissHintForDoc(currentDocId, id);
  };

  const convertInsightToFeature = async (insight: ProactiveInsight, idx: number) => {
    const key = `insight-${idx}`;
    setIsGeneratingFeatureId(key);
    try {
      const draft = await generateFeatureFromInsightAction(insight);
      setFeatureDrafts((prev) => ({ ...prev, [key]: draft }));
    } catch (error) {
      console.error("Feature generation failed:", error);
    } finally {
      setIsGeneratingFeatureId(null);
    }
  };

  const insertFeatureDraft = (key: string) => {
    const content = featureDrafts[key];
    if (!content) return;

    setPendingInsertion(content);
    setFeatureDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const convertDecisionToPRD = async (decision: { text: string; confidence: number; why: string }, idx: number) => {
    const decisionId = `decision-${idx}`;
    setIsGeneratingPRDFromDecision(decisionId);
    try {
      const prdMarkdown = await generatePRDFromDecisionAction({
        title: decision.text,
        justification: decision.why,
        priority: "medium",
        impact: Math.max(4, Math.min(8, decision.confidence)),
        effort: 5,
        userStory: `As a product team, we want to explore ${decision.text.toLowerCase()} so that we can validate whether it should become a roadmap item.`,
        tradeoffs: "Exploratory direction; validate before committing to delivery.",
      });
      setPendingDecisionForPRD({
        title: decision.text,
        priority: "medium",
        userStory: `As a product team, we want to explore ${decision.text.toLowerCase()} so that we can validate whether it should become a roadmap item.`,
        tradeoffs: "Exploratory direction; validate before committing to delivery.",
      });
      setPendingInsertion(prdMarkdown);
      dismissHint(decisionId);
    } catch (error) {
      console.error("[AIPanel] Failed to generate PRD from decision:", error);
      alert("Failed to generate PRD. Please try again.");
    } finally {
      setIsGeneratingPRDFromDecision(null);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const token = await user?.getIdToken();
    if (!token) {
      setMessages((prev) => [...prev, {
        id: nextMessageId(),
        role: "assistant",
        content: "Please sign in again to use the AI assistant.",
      }]);
      return;
    }
    const userMessage: Message = {
      id: nextMessageId(),
      role: "user",
      content: messageText.trim(),
    };

    const conversation = [...messages, userMessage];

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const assistantId = nextMessageId();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [
            ...(activeContext.trim()
              ? [{ role: "system", content: `Current workspace context:\n${activeContext.trim()}` }]
              : []),
            ...conversation,
          ].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("API error");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response body");

      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (controller.signal.aborted || !isMountedRef.current) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: accumulated } : m
          )
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("AI Error:", error);
      if (!isMountedRef.current) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "⚠ The AI engine encountered an error. Please try again." }
            : m
        )
      );
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
      }
      if (isMountedRef.current) setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const triggerPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="flex h-full flex-col bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 h-14 px-4 shrink-0 bg-muted/50">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          Assistant
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleAiPanel}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Close assistant"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-3 overflow-auto space-y-3">
        <div className="rounded-lg border border-border/70 bg-background p-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Current context</p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">{currentUnderstanding}</p>
        </div>

        <div className="rounded-lg border border-border/70 bg-background p-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Quick prompts</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="h-7 rounded-full text-[11px]" onClick={() => triggerPrompt("Define the problem precisely: who is affected, what behavior is broken, and which metric is impacted?")}>Define problem</Button>
            <Button size="sm" variant="outline" className="h-7 rounded-full text-[11px]" onClick={() => triggerPrompt("Generate three testable product hypotheses from the current context.")}>Generate hypothesis</Button>
            <Button size="sm" variant="outline" className="h-7 rounded-full text-[11px]" onClick={() => triggerPrompt("Identify top execution and product risks in this idea, with mitigation options.")}>Identify risks</Button>
          </div>
        </div>

        {(weakProblemSignal || repeatedPatternInsight) && (
          <div className="rounded-lg border border-border/70 bg-background p-3 space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Live hints</p>
            {weakProblemSignal && <p className="text-xs text-foreground">{weakProblemSignal}</p>}
            {repeatedPatternInsight && <p className="text-xs text-foreground">{repeatedPatternInsight}</p>}
          </div>
        )}

        <div className="rounded-lg border border-primary/20 bg-background p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-medium text-primary">Signals</span>
            </div>
            <div className="flex items-center gap-2">
              {isAnalyzing && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary/60" />}
              <button
                type="button"
                onClick={() => setShowDetailedSignals((prev) => !prev)}
                className="text-[11px] text-primary hover:opacity-80"
              >
                {showDetailedSignals ? "Hide" : `Show ${signalCount}`}
              </button>
            </div>
          </div>

          {!showDetailedSignals && (
            <p className="text-xs text-muted-foreground">Pause typing to surface proactive insights from your current draft.</p>
          )}

          {showDetailedSignals && signals.insights
            .map((insight, idx) => ({ insight, idx, id: `insight-${idx}` }))
            .filter(({ id }) => !dismissed.has(id))
            .map(({ insight, idx, id }) => (
              <div key={id} className="rounded-md border border-primary/20 bg-white p-2.5 border-l-4 border-l-primary">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[12px] font-semibold text-foreground">{insight.title}</p>
                    <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{insight.description}</p>
                  </div>
                  <button
                    onClick={() => dismissHint(id)}
                    className="text-muted-foreground/70 hover:text-foreground"
                    aria-label="Dismiss insight"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => convertInsightToFeature(insight, idx)}
                    disabled={isGeneratingFeatureId === id}
                  >
                    {isGeneratingFeatureId === id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                    Convert to Feature
                  </Button>
                  {featureDrafts[id] && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] text-primary"
                      onClick={() => insertFeatureDraft(id)}
                    >
                      Insert in Editor
                    </Button>
                  )}
                </div>
              </div>
            ))}

          {showDetailedSignals && signals.suggestions
            .map((s, idx) => ({ s, id: `suggestion-${idx}` }))
            .filter(({ id }) => !dismissed.has(id))
            .map(({ s, id }) => (
              <div key={id} className="rounded-md border border-border/70 bg-white p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-3.5 w-3.5 text-primary mt-0.5" />
                    <div>
                      <p className="text-[12px] leading-relaxed text-foreground">{s.text}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Why: {s.why}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="label-system text-[10px] px-1.5 py-0.5 rounded bg-muted/20">{s.confidence}/10</span>
                    <button
                      onClick={() => dismissHint(id)}
                      className="text-muted-foreground/70 hover:text-foreground"
                      aria-label="Dismiss suggestion"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

          {showDetailedSignals && signals.challenges
            .map((c, idx) => ({ c, id: `challenge-${idx}` }))
            .filter(({ id }) => !dismissed.has(id))
            .map(({ c, id }) => (
              <div key={id} className="rounded-md border border-primary/20 bg-primary/5 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-primary mt-0.5" />
                    <div>
                      <p className="text-[12px] leading-relaxed text-foreground">{c.text}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Why: {c.why}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="label-system text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{c.confidence}/10</span>
                    <button
                      onClick={() => dismissHint(id)}
                      className="text-muted-foreground/70 hover:text-foreground"
                      aria-label="Dismiss challenge"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

          {showDetailedSignals && signals.decisions
            ?.map((d, idx) => ({ d, id: `decision-${idx}` }))
            .filter(({ id }) => !dismissed.has(id))
            .map(({ d, id }, idx) => (
              <div key={id} className="rounded-md border border-primary/20 bg-white p-2.5 border-l-4 border-l-primary">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-[12px] font-semibold text-foreground">{d.text}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Why: {d.why}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="label-system text-[10px] px-1.5 py-0.5 rounded bg-muted/20">{d.confidence}/10</span>
                    <button
                      onClick={() => dismissHint(id)}
                      className="text-muted-foreground/70 hover:text-foreground"
                      aria-label="Dismiss decision"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-7 text-[11px] mt-2 w-full"
                  onClick={() => convertDecisionToPRD(d, idx)}
                  disabled={isGeneratingPRDFromDecision === id}
                >
                  {isGeneratingPRDFromDecision === id ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  {isGeneratingPRDFromDecision === id ? "Generating PRD..." : "Convert to PRD"}
                </Button>
              </div>
            ))}

          {showDetailedSignals && !isAnalyzing &&
            signals.insights.length === 0 &&
            signals.suggestions.length === 0 &&
            signals.challenges.length === 0 &&
            (!signals.decisions || signals.decisions.length === 0) && (
              <p className="text-[12px] text-muted-foreground">Keep writing. AI will surface proactive guidance after a few seconds of stable context.</p>
            )}
        </div>

        {showDetailedSignals && signals.decisions && signals.decisions.length > 0 && (
          <div className="rounded-2xl border border-border/70 bg-white p-3 shadow-sm">
            <p className="label-system text-[11px] text-primary">Decision Timeline</p>
            <div className="mt-2 space-y-2">
              {signals.decisions.slice(0, 3).map((decision, idx) => (
                <div key={`timeline-${decision.text}-${idx}`} className="rounded-xl border border-border/60 bg-[#fcfaf4] px-3 py-2">
                  <p className="text-xs font-semibold text-foreground">{decision.text}</p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />Just now</span>
                    <span>Confidence {decision.confidence}/10</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-sidebar border border-border p-3 text-sm shadow-sm">
              <p className="text-muted-foreground leading-relaxed">
                {user
                  ? `Welcome back, ${user.displayName?.split(" ")[0] || "there"}! Highlight text in the editor or use a shortcut below.`
                  : "Highlight text in the editor or ask a question below to get insights."}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="justify-start label-system text-[12px] border-primary/20 hover:border-primary/50 hover:bg-primary/5 text-foreground h-9"
                onClick={() => triggerPrompt("Generate a comprehensive PRD for this product concept. Include: overview, problem statement, user stories, functional requirements, success metrics, and technical considerations.")}
              >
                <Wand2 className="mr-2 h-3 w-3 text-primary shrink-0" />
                Generate PRD
              </Button>
              <Button
                variant="outline"
                className="justify-start label-system text-[12px] border-border/60 hover:border-primary/40 hover:bg-muted/50 text-foreground h-9"
                onClick={() => triggerPrompt("Extract the key product insights from what I've described. Identify: pain points, target users, market opportunity, and differentiation.")}
              >
                <Lightbulb className="mr-2 h-3 w-3 text-yellow-500 shrink-0" />
                Extract Insights
              </Button>
              <Button
                variant="outline"
                className="justify-start label-system text-[12px] border-border/60 hover:border-primary/40 hover:bg-muted/50 text-foreground h-9"
                onClick={() => triggerPrompt("Based on the product concept described, suggest a prioritized list of execution tasks and milestones for the first 90 days. Format as a structured action plan.")}
              >
                <CheckSquare className="mr-2 h-3 w-3 text-green-500 shrink-0" />
                Suggest Execution Tasks
              </Button>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg text-sm shadow-sm p-3 ${
                m.role === "user"
                  ? "bg-primary/10 text-foreground ml-6 border border-primary/20"
                  : "bg-sidebar border border-border mr-6"
              }`}
            >
              <span className="label-system text-[12px] mb-1.5 block">
                {m.role === "user" ? "You" : "Buildcase AI"}
              </span>
              <div className="whitespace-pre-wrap leading-relaxed text-[13px] font-normal">{m.content || (isLoading ? "▋" : "")}</div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-center gap-2 label-system text-[12px] p-2">
            <Loader2 className="h-3 w-3 animate-spin text-primary/40" />
            <span>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border/70 shrink-0 bg-[#efe8d8]">
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 h-6 label-system text-[12px] hover:text-primary hover:bg-transparent w-full"
            onClick={() => setMessages([])}
          >
            Clear conversation
          </Button>
        )}
        <form className="relative flex items-end gap-2" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 min-h-[64px] max-h-[140px] text-sm resize-none rounded-lg border border-input bg-background px-3 py-2 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring leading-relaxed"
            placeholder="Ask Buildcase..."
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            size="icon"
            className="h-9 w-9 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
