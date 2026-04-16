"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { X, Sparkles, Wand2, Lightbulb, Send, Loader2, CheckSquare, AlertTriangle, Plus } from "lucide-react";
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
  const [signals, setSignals] = React.useState<ProactiveThinkingSignals>({ insights: [], suggestions: [], challenges: [] });
  const [featureDrafts, setFeatureDrafts] = React.useState<Record<string, string>>({});
  const [isGeneratingFeatureId, setIsGeneratingFeatureId] = React.useState<string | null>(null);
    const [isGeneratingPRDFromDecision, setIsGeneratingPRDFromDecision] = React.useState<string | null>(null);
  const lastAnalyzedRef = React.useRef("");
  const lastAnalyzedAtRef = React.useRef(0);
  const analyzeTimerRef = React.useRef<number | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const ANALYZE_DEBOUNCE_MS = 4000;
  const ANALYZE_COOLDOWN_MS = 12000;
  const MAX_CONTEXT_CHARS = 6000;

  const hashContent = (value: string) => value.trim().replace(/\s+/g, " ");

  const dismissed = React.useMemo(() => {
    if (!currentDocId) return new Set<string>();
    return new Set(dismissedHintsByDoc[currentDocId] ?? []);
  }, [currentDocId, dismissedHintsByDoc]);

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
        id: Date.now().toString(),
        role: "assistant",
        content: "Please sign in again to use the AI assistant.",
      }]);
      return;
    }
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText.trim(),
    };

    const conversation = [...messages, userMessage];

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Add a placeholder assistant message for streaming
    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

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
      });

      if (!response.ok) throw new Error("API error");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response body");

      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: accumulated } : m
          )
        );
      }
    } catch (error) {
      console.error("AI Error:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "⚠ The AI engine encountered an error. Please try again." }
            : m
        )
      );
    } finally {
      setIsLoading(false);
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
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border h-14 px-4 shrink-0 bg-sidebar">
        <div className="flex items-center gap-2 label-system text-sm font-semibold tracking-[0.05em]">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Assistant
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleAiPanel}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-auto space-y-3 bg-background/30">
        <div className="rounded-lg border border-primary/20 bg-white/80 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="label-system text-[11px] text-primary">Proactive Intelligence</span>
            </div>
            {isAnalyzing && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary/60" />}
          </div>

          {signals.insights
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

          {signals.suggestions
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

          {signals.challenges
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

          {signals.decisions
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

          {!isAnalyzing &&
            signals.insights.length === 0 &&
            signals.suggestions.length === 0 &&
            signals.challenges.length === 0 &&
            (!signals.decisions || signals.decisions.length === 0) && (
              <p className="text-[12px] text-muted-foreground">Keep writing. AI will surface proactive guidance after a few seconds of stable context.</p>
            )}
        </div>

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
      <div className="p-3 border-t border-border shrink-0 bg-sidebar">
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
            className="flex-1 min-h-[72px] max-h-[160px] text-sm resize-none rounded-lg border border-input bg-background px-3 py-2.5 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring leading-relaxed"
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
