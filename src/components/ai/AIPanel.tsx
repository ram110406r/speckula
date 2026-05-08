"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  X, Sparkles, Lightbulb, Send, Loader2, AlertTriangle, Plus,
  Target, FlaskConical, ShieldAlert,
} from "lucide-react";
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
  const analyzeAbortRef = React.useRef<AbortController | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const streamAbortRef = React.useRef<AbortController | null>(null);
  const isMountedRef = React.useRef(true);
  const messageIdRef = React.useRef(0);
  const nextMessageId = React.useCallback(() => `msg-${++messageIdRef.current}`, []);

  // Hard-limit background auto-analysis to 15 calls per session day. At ~500
  // tokens each, that's 7 500 tokens — a fraction of Groq's free-tier TPD.
  const ANALYZE_DAILY_CAP = 15;
  const analyzeCountRef = React.useRef<{ date: string; n: number }>({ date: "", n: 0 });

  // Circuit-breaker that survives page reloads via localStorage.
  // On 429, we parse Groq's "Please try again in Xm Ys" and block until then.
  const LS_KEY = "groq_rate_limited_until";
  const rateLimitedRef = React.useRef<boolean>(false);
  // Initialise from localStorage on first render (client-side only).
  React.useEffect(() => {
    try {
      const v = localStorage.getItem(LS_KEY);
      if (v && parseInt(v, 10) > Date.now()) rateLimitedRef.current = true;
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRateLimitBlock = React.useCallback((errorMsg: string) => {
    const match = errorMsg.match(/Please try again in (?:(\d+)m)?(?:([\d.]+)s)?/);
    const minutes = parseFloat(match?.[1] ?? "0");
    const seconds = parseFloat(match?.[2] ?? "0");
    const waitMs = Math.ceil((minutes * 60 + seconds) * 1000) + 10_000; // +10s buffer
    const until = Date.now() + (waitMs > 0 ? waitMs : 5 * 60 * 1000);
    rateLimitedRef.current = true;
    try { localStorage.setItem(LS_KEY, String(until)); } catch { /* ignore */ }
  }, []);

  const incrementAnalyzeCount = React.useCallback((): boolean => {
    // Re-check localStorage on each attempt in case the block expired.
    if (rateLimitedRef.current) {
      try {
        const v = localStorage.getItem(LS_KEY);
        if (!v || parseInt(v, 10) <= Date.now()) {
          rateLimitedRef.current = false;
          localStorage.removeItem(LS_KEY);
        }
      } catch { /* ignore */ }
    }
    if (rateLimitedRef.current) return false;
    const today = new Date().toISOString().slice(0, 10);
    if (analyzeCountRef.current.date !== today) {
      analyzeCountRef.current = { date: today, n: 0 };
    }
    if (analyzeCountRef.current.n >= ANALYZE_DAILY_CAP) return false;
    analyzeCountRef.current.n += 1;
    return true;
  }, []);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      streamAbortRef.current?.abort();
      analyzeAbortRef.current?.abort();
    };
  }, []);

  const ANALYZE_DEBOUNCE_MS = 4000;
  // 5-minute cooldown keeps background calls to ≤12/hour even with a very
  // active user, vs the previous 12s which allowed ~300/hour.
  const ANALYZE_COOLDOWN_MS = 300_000;
  const MAX_CONTEXT_CHARS = 6000;

  const hashContent = (value: string) => value.trim().replace(/\s+/g, " ");

  const dismissed = React.useMemo(() => {
    if (!currentDocId) return new Set<string>();
    return new Set(dismissedHintsByDoc[currentDocId] ?? []);
  }, [currentDocId, dismissedHintsByDoc]);

  const currentUnderstanding = React.useMemo(() => {
    const trimmed = activeContext.trim();
    if (!trimmed) return "";
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
    const repeated = [...counts.entries()].sort((a, b) => b[1] - a[1]).find((item) => item[1] >= 3);
    if (!repeated) return null;
    return `You mentioned "${repeated[0]}" multiple times — this may be your core problem.`;
  }, [activeContext]);

  const weakProblemSignal = React.useMemo(() => {
    const normalized = activeContext.toLowerCase();
    if (normalized.length < 80) return null;
    const hasSpecificSignal = /(who|metric|drop|retention|conversion|churn|activation|behavior|cohort|timeframe)/.test(normalized);
    if (hasSpecificSignal) return null;
    return "Weak problem definition detected. Ask: Who is affected? What behavior? Which metric?";
  }, [activeContext]);

  const signalCount = signals.insights.length + signals.suggestions.length + signals.challenges.length + (signals.decisions?.length ?? 0);

  React.useEffect(() => {
    setMessages([]);
    setInput("");
    setSignals({ insights: [], suggestions: [], challenges: [], decisions: [] });
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
    analyzeAbortRef.current?.abort();
    analyzeAbortRef.current = null;
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
  }, [currentDocId]);

  React.useEffect(() => {
    const normalized = hashContent(activeContext);
    if (!user || normalized.length < 120) return;
    if (normalized === lastAnalyzedRef.current) return;
    const now = Date.now();
    if (now - lastAnalyzedAtRef.current < ANALYZE_COOLDOWN_MS) return;
    if (analyzeTimerRef.current) window.clearTimeout(analyzeTimerRef.current);

    analyzeTimerRef.current = window.setTimeout(async () => {
      if (!incrementAnalyzeCount()) return;
      const docAtLaunch = currentDocId;
      analyzeAbortRef.current?.abort();
      const controller = new AbortController();
      analyzeAbortRef.current = controller;
      if (!isMountedRef.current) return;
      setIsAnalyzing(true);
      try {
        const boundedContext = activeContext.length > MAX_CONTEXT_CHARS
          ? activeContext.slice(-MAX_CONTEXT_CHARS)
          : activeContext;
        const data = await analyzeThinkingSignalsAction(boundedContext, controller.signal);
        if (controller.signal.aborted || docAtLaunch !== currentDocId || !isMountedRef.current) return;
        setSignals(data);
        lastAnalyzedRef.current = normalized;
        lastAnalyzedAtRef.current = Date.now();
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") return;
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
          setRateLimitBlock(msg);
        } else if (/50[0-9]/.test(msg)) {
          // Backend error — back off for the full cooldown window to avoid hammering
          lastAnalyzedAtRef.current = Date.now();
        }
        console.error("Proactive analysis failed:", error);
      } finally {
        if (isMountedRef.current) setIsAnalyzing(false);
        if (analyzeAbortRef.current === controller) analyzeAbortRef.current = null;
      }
    }, ANALYZE_DEBOUNCE_MS);

    return () => {
      if (analyzeTimerRef.current) window.clearTimeout(analyzeTimerRef.current);
      analyzeAbortRef.current?.abort();
    };
  }, [activeContext, user, currentDocId, incrementAnalyzeCount]);

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
        impact: 5,
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

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;
    const token = await user?.getIdToken();
    if (!token) {
      setMessages((prev) => [...prev, { id: nextMessageId(), role: "assistant", content: "Please sign in again to use the AI assistant." }]);
      return;
    }
    const userMessage: Message = { id: nextMessageId(), role: "user", content: messageText.trim() };
    const ERROR_SENTINEL = "⚠ The AI engine encountered an error. Please try again.";
    const cleanHistory = messages.filter((m) => m.content !== ERROR_SENTINEL);
    const conversation = [...cleanHistory, userMessage];

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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...(activeContext.trim() ? { system: `Use this workspace context as background only:\n${activeContext.trim()}` } : {}),
          messages: conversation.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`API error ${response.status}: ${detail || response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      let accumulated = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (controller.signal.aborted || !isMountedRef.current) {
            await reader.cancel().catch(() => undefined);
            break;
          }
          accumulated += decoder.decode(value, { stream: true });
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m));
        }
        const tail = decoder.decode();
        if (tail) {
          accumulated += tail;
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m));
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }

      if (!accumulated.trim() && isMountedRef.current) {
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: "(No response. Try again or rephrase your question.)" } : m));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("AI Error:", error);
      if (!isMountedRef.current) return;
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: "⚠ The AI engine encountered an error. Please try again." } : m));
    } finally {
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
      if (isMountedRef.current) setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const triggerPrompt = (prompt: string) => sendMessage(prompt);

  /* ─── Quick action card definitions ──────────────────────────────────────── */
  const quickActions = [
    {
      icon: Target,
      label: "Define Problem",
      desc: "Clarify who is affected and which metric is broken",
      prompt: "Define the problem precisely: who is affected, what behavior is broken, and which metric is impacted?",
      iconColor: "text-primary",
      iconBg: "bg-primary/10 group-hover:bg-primary/20",
    },
    {
      icon: FlaskConical,
      label: "Generate Hypothesis",
      desc: "Create three testable product hypotheses",
      prompt: "Generate three testable product hypotheses from the current context.",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-500/10 group-hover:bg-emerald-500/20",
    },
    {
      icon: ShieldAlert,
      label: "Identify Risks",
      desc: "Surface execution and product risks with mitigations",
      prompt: "Identify top execution and product risks in this idea, with mitigation options.",
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-500/10 group-hover:bg-amber-500/20",
    },
  ] as const;

  return (
    <div className="flex h-full flex-col bg-background">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            {/* Pulse dot */}
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground leading-none">Speckula AI</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">Thinking about your case...</p>
          </div>
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

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 space-y-4 custom-scrollbar">

        {/* Case context summary */}
        <div className="rounded-xl border border-border/60 bg-card p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1.5">Case Context</p>
          {currentUnderstanding ? (
            <p className="text-[12px] text-foreground leading-relaxed">{currentUnderstanding}</p>
          ) : (
            <p className="text-[12px] text-muted-foreground italic leading-relaxed">
              Start describing your product idea to activate insights.
            </p>
          )}
        </div>

        {/* Quick action cards */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground px-0.5">Quick Actions</p>
          <div className="flex flex-col gap-2">
            {quickActions.map(({ icon: Icon, label, desc, prompt, iconColor, iconBg }) => (
              <button
                key={label}
                type="button"
                onClick={() => triggerPrompt(prompt)}
                className="group flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-card text-left hover:border-primary/30 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 active:translate-y-0 active:shadow-none"
              >
                <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${iconBg}`}>
                  <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-foreground leading-tight">{label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Live warnings */}
        {(weakProblemSignal || repeatedPatternInsight) && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground px-0.5">Warnings</p>

            {weakProblemSignal && (
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-warning">High</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">Problem Definition</span>
                </div>
                <p className="text-[12px] text-foreground leading-snug mb-3">{weakProblemSignal}</p>
                <button
                  type="button"
                  onClick={() => triggerPrompt("Define the problem precisely: who is affected, what behavior is broken, and which metric is impacted?")}
                  className="text-[11px] font-semibold text-warning hover:opacity-75 transition-opacity"
                >
                  Fix Now →
                </button>
              </div>
            )}

            {repeatedPatternInsight && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-blue-500">Low</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">Pattern Detected</span>
                </div>
                <p className="text-[12px] text-foreground leading-snug">{repeatedPatternInsight}</p>
              </div>
            )}
          </div>
        )}

        {/* Intelligence / Signals */}
        <div className="rounded-xl border border-primary/20 bg-card p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-primary tracking-[0.03em]">Intelligence</span>
            </div>
            <div className="flex items-center gap-1.5">
              {isAnalyzing && <Loader2 className="h-3 w-3 animate-spin text-primary/60" />}
              {!isAnalyzing && signalCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDetailedSignals((p) => !p)}
                  className="text-[11px] font-medium text-primary hover:opacity-75 transition-opacity"
                >
                  {showDetailedSignals ? "Collapse" : `${signalCount} insight${signalCount !== 1 ? "s" : ""}`}
                </button>
              )}
            </div>
          </div>

          {/* Scanning animation */}
          {isAnalyzing && (
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-[12px] text-muted-foreground">Scanning your draft...</span>
            </div>
          )}

          {/* No signals yet */}
          {!isAnalyzing && signalCount === 0 && (
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Keep writing — Speckula surfaces insights automatically after a few seconds of stable content.
            </p>
          )}

          {/* Signals found summary (collapsed) */}
          {!isAnalyzing && signalCount > 0 && !showDetailedSignals && (
            <button
              type="button"
              onClick={() => setShowDetailedSignals(true)}
              className="flex items-center gap-2 w-full group"
            >
              <div className="flex -space-x-1">
                {signals.insights.length > 0 && <div className="w-2 h-2 rounded-full bg-primary ring-2 ring-card" />}
                {signals.suggestions.length > 0 && <div className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-card" />}
                {signals.challenges.length > 0 && <div className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-card" />}
                {(signals.decisions?.length ?? 0) > 0 && <div className="w-2 h-2 rounded-full bg-blue-500 ring-2 ring-card" />}
              </div>
              <p className="text-[12px] text-muted-foreground group-hover:text-foreground transition-colors">
                {signalCount} signal{signalCount !== 1 ? "s" : ""} found.{" "}
                <span className="text-primary font-medium">View all →</span>
              </p>
            </button>
          )}

          {/* Expanded signals */}
          {showDetailedSignals && (
            <div className="space-y-2">

              {signals.insights
                .map((insight, idx) => ({ insight, idx, id: `insight-${idx}` }))
                .filter(({ id }) => !dismissed.has(id))
                .map(({ insight, idx, id }) => (
                  <div key={id} className="rounded-lg border-l-4 border border-primary/20 border-l-primary bg-primary/5 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-foreground">{insight.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{insight.description}</p>
                      </div>
                      <button onClick={() => dismissHint(id)} className="text-muted-foreground/50 hover:text-foreground shrink-0 transition-colors" aria-label="Dismiss">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[11px] border-primary/30 hover:bg-primary/10 hover:border-primary/50"
                        onClick={() => convertInsightToFeature(insight, idx)}
                        disabled={isGeneratingFeatureId === id}
                      >
                        {isGeneratingFeatureId === id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                        Convert to Feature
                      </Button>
                      {featureDrafts[id] && (
                        <Button variant="ghost" size="sm" className="h-6 text-[11px] text-primary" onClick={() => insertFeatureDraft(id)}>
                          Insert
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

              {signals.suggestions
                .map((s, idx) => ({ s, id: `suggestion-${idx}` }))
                .filter(({ id }) => !dismissed.has(id))
                .map(({ s, id }) => (
                  <div key={id} className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[12px] leading-snug text-foreground">{s.text}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Why: {s.why}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium">{s.confidence}/10</span>
                        <button onClick={() => dismissHint(id)} className="text-muted-foreground/50 hover:text-foreground transition-colors" aria-label="Dismiss">
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
                  <div key={id} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[12px] leading-snug text-foreground">{c.text}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Why: {c.why}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium">{c.confidence}/10</span>
                        <button onClick={() => dismissHint(id)} className="text-muted-foreground/50 hover:text-foreground transition-colors" aria-label="Dismiss">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {signals.decisions
                ?.map((d, idx) => ({ d, idx, id: `decision-${idx}` }))
                .filter(({ id }) => !dismissed.has(id))
                .map(({ d, idx, id }) => (
                  <div key={id} className="rounded-lg border-l-4 border border-blue-500/20 border-l-blue-500 bg-blue-500/5 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-foreground">{d.text}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Why: {d.why}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400 font-medium">{d.confidence}/10</span>
                        <button onClick={() => dismissHint(id)} className="text-muted-foreground/50 hover:text-foreground transition-colors" aria-label="Dismiss">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="h-6 text-[11px] mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => convertDecisionToPRD(d, idx)}
                      disabled={isGeneratingPRDFromDecision === id}
                    >
                      {isGeneratingPRDFromDecision === id
                        ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        : <Sparkles className="h-3 w-3 mr-1" />}
                      {isGeneratingPRDFromDecision === id ? "Generating PRD..." : "Convert to PRD"}
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Chat messages */}
        {messages.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-3.5">
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {user
                ? "Ask anything about your case — strategy, risks, features, or roadmap."
                : "Sign in to start chatting with Speckula AI."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl text-sm p-3 ${
                  m.role === "user"
                    ? "bg-primary/10 text-foreground ml-2 sm:ml-4 border border-primary/20"
                    : "bg-card border border-border/60 mr-2 sm:mr-4"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5 block">
                  {m.role === "user" ? "You" : "Speckula AI"}
                </span>
                <div className="whitespace-pre-wrap leading-relaxed text-[13px]">
                  {m.content || (isLoading ? "▋" : "")}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 pl-1">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-[12px] text-muted-foreground">Thinking...</span>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ──────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-border/70 shrink-0 bg-card">
        {messages.length > 0 && (
          <button
            type="button"
            className="mb-2 w-full text-center text-[11px] text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setMessages([])}
          >
            Clear conversation
          </button>
        )}
        <form className="flex items-end gap-2" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 min-h-[60px] max-h-[120px] text-sm resize-none rounded-xl border border-input bg-background px-3 py-2.5 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 leading-relaxed transition-all duration-150"
            placeholder="Ask Speckula anything..."
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
            className="h-11 w-11 sm:h-9 sm:w-9 shrink-0 rounded-xl text-white hover:opacity-90 transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "#7E43F5" }}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
