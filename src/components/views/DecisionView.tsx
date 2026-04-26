"use client";

import React from "react";
import { Compass, Sparkles, Loader2, Target, Zap, Brain, AlertTriangle, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { getDocument, saveDecision, savePRD } from "@/lib/firebase/db";
import {
  suggestDirectionAction,
  strategicGuidanceAction,
  generatePRDFromDecisionAction,
  generateOpportunityScore,
  submitOutcomeFeedback,
  generateCaseBriefAction,
  type DecisionSuggestion,
  type StrategicGuidance,
  type CaseBriefData,
} from "@/lib/ai/actions";
import { generateLearningInsight } from "@/lib/ai/learningEngine";
import { calculateScore, type OpportunityScoreData } from "@/lib/ai/scoreEngine";
import { updateScore, type OpportunityScoreState } from "@/lib/ai/scoreEvolution";
import { getScoreHistory, recordScoreHistory, type OpportunityScoreHistoryEntry } from "@/lib/ai/scoreHistory";
import { ScoreCard } from "@/components/decision/ScoreCard";
import { BreakdownChart } from "@/components/decision/BreakdownChart";
import { ScoreHistoryGraph } from "@/components/decision/ScoreHistoryGraph";
import { Input } from "@/components/ui/input";
import { OutcomeCard } from "@/components/outcome/OutcomeCard";
import { LearningInsight } from "@/components/outcome/LearningInsight";
import { ScoreAdjustment } from "@/components/outcome/ScoreAdjustment";
import { compareOutcomes, type OutcomeComparison } from "@/lib/ai/comparisonEngine";
import { getExpectedOutcome, setExpectedOutcome, type ExpectedOutcomeRecord } from "@/lib/ai/expectedOutcome";
import { getActualOutcome, recordActualOutcome, type ActualOutcomeRecord } from "@/lib/ai/actualOutcome";
import { updateConfidenceScore } from "@/lib/ai/scoreFeedback";
import { evaluateDecisionHealth, evaluatePushback, type HealthStatus, type PushbackAction } from "@/lib/ai/decisionHealth";
import { CaseBriefDialog } from "@/components/decision/CaseBriefDialog";

const priorityColors = {
  high: "text-primary border-primary/20 bg-primary/5",
  medium: "text-muted-foreground border-border bg-muted/5",
  low: "text-muted-foreground/60 border-border/40 bg-transparent",
};

const healthStyles: Record<HealthStatus, { pill: string; dot: string }> = {
  healthy: {
    pill: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  risky: {
    pill: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  weak: {
    pill: "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
};

const healthLabel: Record<HealthStatus, string> = {
  healthy: "Healthy",
  risky: "Risky",
  weak: "Weak",
};

interface ScoredDecision extends DecisionSuggestion {
  decisionId: string;
  scoreBreakdown: OpportunityScoreData;
  score: number;
}

interface FeedbackCardState {
  expected: string;
  actual: string;
  submitting: boolean;
  submitted: boolean;
  shipped: boolean;
  insight?: string;
  confidenceBefore?: number;
  confidenceAfter?: number;
}

export function DecisionView() {
  const { user } = useAuth();
  const { currentDocId, setPendingInsertion, setActiveView, setPendingDecisionForPRD, setOutcomeLoop } = useAppStore();
  const [suggestions, setSuggestions] = React.useState<DecisionSuggestion[]>([]);
  const [scoredSuggestions, setScoredSuggestions] = React.useState<ScoredDecision[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [strategicGuidance, setStrategicGuidance] = React.useState<StrategicGuidance | null>(null);
  const [scoreSummary, setScoreSummary] = React.useState<OpportunityScoreData & { score: number } | null>(null);
  const [scoreHistory, setScoreHistory] = React.useState<OpportunityScoreHistoryEntry[]>([]);
  const [expectedOutcome, setExpectedOutcomeState] = React.useState<ExpectedOutcomeRecord | null>(null);
  const [actualOutcome, setActualOutcomeState] = React.useState<ActualOutcomeRecord | null>(null);
  const [comparison, setComparison] = React.useState<OutcomeComparison | null>(null);
  const [learningInsight, setLearningInsight] = React.useState<string | null>(null);
  const [confidenceBefore, setConfidenceBefore] = React.useState(0);
  const [confidenceAfter, setConfidenceAfter] = React.useState(0);
  const [expectedMetric, setExpectedMetric] = React.useState("");
  const [expectedTarget, setExpectedTarget] = React.useState("");
  const [expectedTimeframe, setExpectedTimeframe] = React.useState("");
  const [actualMetric, setActualMetric] = React.useState("");
  const [actualValue, setActualValue] = React.useState("");
  const [isGeneratingPRDFor, setIsGeneratingPRDFor] = React.useState<string | null>(null);
  const [prdPreview, setPrdPreview] = React.useState<{ title: string; content: string; decision: DecisionSuggestion } | null>(null);
  const [feedbackByCard, setFeedbackByCard] = React.useState<Record<string, FeedbackCardState>>({});
  const [briefDialog, setBriefDialog] = React.useState<{
    open: boolean;
    loading: boolean;
    data: CaseBriefData | null;
    error: string | null;
    decisionId: string | null;
  }>({ open: false, loading: false, data: null, error: null, decisionId: null });

  const getFeedbackState = (decisionId: string): FeedbackCardState =>
    feedbackByCard[decisionId] ?? { expected: "", actual: "", submitting: false, submitted: false, shipped: false };

  const updateFeedbackState = (decisionId: string, patch: Partial<FeedbackCardState>) => {
    setFeedbackByCard((prev) => ({
      ...prev,
      [decisionId]: { ...getFeedbackState(decisionId), ...patch },
    }));
  };

  const handleGenerateCaseBrief = async (decision: ScoredDecision) => {
    if (!user || !currentDocId) return;
    setBriefDialog({ open: true, loading: true, data: null, error: null, decisionId: decision.decisionId });
    try {
      const doc = await getDocument(user.uid, currentDocId);
      const data = await generateCaseBriefAction(
        {
          title: decision.title,
          justification: decision.justification,
          userStory: decision.userStory,
          tradeoffs: decision.tradeoffs,
          priority: decision.priority,
          impact: decision.scoreBreakdown.impact,
          effort: decision.scoreBreakdown.effort,
          confidence: decision.scoreBreakdown.confidence,
          demand: decision.scoreBreakdown.demand,
          score: decision.score,
          reasoning: decision.scoreBreakdown.reasoning,
        },
        doc?.content
      );
      setBriefDialog({ open: true, loading: false, data, error: null, decisionId: decision.decisionId });
    } catch (error) {
      console.error("Case brief generation failed:", error);
      setBriefDialog({
        open: true,
        loading: false,
        data: null,
        error: error instanceof Error ? error.message : "Failed to draft brief.",
        decisionId: decision.decisionId,
      });
    }
  };

  const handlePushbackCta = (action: PushbackAction) => {
    if (action === "add-evidence") {
      setActiveView("editor");
      return;
    }
    if (action === "rescore") {
      handleGenerate();
    }
  };

  const handleSubmitFeedback = async (decision: ScoredDecision, success: boolean) => {
    const state = getFeedbackState(decision.decisionId);
    if (state.submitting || state.submitted) return;
    if (!state.expected.trim() || !state.actual.trim()) return;

    updateFeedbackState(decision.decisionId, { submitting: true });

    const currentScore: OpportunityScoreState = {
      impact: decision.scoreBreakdown.impact,
      effort: decision.scoreBreakdown.effort,
      confidence: decision.scoreBreakdown.confidence,
      demand: decision.scoreBreakdown.demand,
      score: decision.score,
    };
    const previousConfidence = currentScore.confidence;

    try {
      const { updatedScore, insight } = await submitOutcomeFeedback(
        decision.decisionId,
        {
          decisionId: decision.decisionId,
          success,
          expected: {
            target_value: state.expected.trim(),
            metric: "",
            timeframe: "",
          },
          actual: {
            value: state.actual.trim(),
            metric: "",
            observedAt: new Date().toISOString(),
          },
        },
        currentScore
      );

      setScoredSuggestions((prev) =>
        prev.map((d) =>
          d.decisionId === decision.decisionId
            ? {
                ...d,
                score: updatedScore.score,
                scoreBreakdown: {
                  ...d.scoreBreakdown,
                  impact: updatedScore.impact,
                  effort: updatedScore.effort,
                  confidence: updatedScore.confidence,
                  demand: updatedScore.demand,
                },
              }
            : d
        )
      );

      updateFeedbackState(decision.decisionId, {
        submitting: false,
        submitted: true,
        insight,
        confidenceBefore: previousConfidence,
        confidenceAfter: updatedScore.confidence,
      });
    } catch (error) {
      console.error("Outcome feedback failed:", error);
      updateFeedbackState(decision.decisionId, { submitting: false });
    }
  };

  React.useEffect(() => {
    if (currentDocId) {
      setScoreHistory(getScoreHistory(currentDocId));
      setExpectedOutcomeState(getExpectedOutcome(currentDocId));
      setActualOutcomeState(getActualOutcome(currentDocId));
    }
  }, [currentDocId]);

  const convertDecisionToPRD = async (decision: DecisionSuggestion, index: number) => {
    if (!user) return;
    const key = `${decision.title}-${index}`;
    setIsGeneratingPRDFor(key);
    try {
      const prdMarkdown = await generatePRDFromDecisionAction(decision);
      setPendingDecisionForPRD({
        title: decision.title,
        priority: decision.priority,
        userStory: decision.userStory,
        tradeoffs: decision.tradeoffs,
      });
      setPrdPreview({
        title: decision.title,
        content: prdMarkdown,
        decision,
      });
    } catch (error) {
      console.error("PRD generation failed:", error);
      alert("Failed to generate PRD from this decision.");
    } finally {
      setIsGeneratingPRDFor(null);
    }
  };

  const handleSavePrd = async () => {
    if (!user || !prdPreview) return;
    try {
      await savePRD(user.uid, {
        title: `PRD: ${prdPreview.title}`,
        content: prdPreview.content,
        status: "draft",
      });
      setPrdPreview(null);
      setPendingDecisionForPRD(null);
      setActiveView("prds");
      alert("PRD saved to your library.");
    } catch (error) {
      console.error("Failed to save PRD:", error);
      alert("Failed to save PRD.");
    }
  };

  const handleInsertPrd = () => {
    if (!prdPreview) return;
    setPendingInsertion(prdPreview.content);
    setPrdPreview(null);
    setPendingDecisionForPRD(null);
    setActiveView("editor");
  };

  const handleGenerate = async () => {
    if (!user || !currentDocId || isLoading) return;
    setIsLoading(true);
    try {
      const doc = await getDocument(user.uid, currentDocId);
      if (!doc || !doc.content) {
        alert("Document is empty. Please add some notes first.");
        return;
      }

      const [guidance, data] = await Promise.all([
        strategicGuidanceAction(doc.content),
        suggestDirectionAction(user.uid, doc.content),
      ]);
      setStrategicGuidance(guidance);
      setSuggestions(data);

      const opportunityScore = await generateOpportunityScore(JSON.stringify(doc.content));
      const latestHistory = scoreHistory.at(-1);
      const evolvedBreakdown = latestHistory
        ? updateScore({ ...latestHistory.breakdown, score: latestHistory.score }, opportunityScore)
        : { ...opportunityScore, score: opportunityScore.score };
      const score = calculateScore(evolvedBreakdown);
      const scoreData = { ...evolvedBreakdown, score, reasoning: opportunityScore.reasoning };
      setScoreSummary(scoreData);
      recordScoreHistory(currentDocId, {
        timestamp: Date.now(),
        score,
        breakdown: {
          impact: scoreData.impact,
          effort: scoreData.effort,
          confidence: scoreData.confidence,
          demand: scoreData.demand,
        },
      });
      setScoreHistory(getScoreHistory(currentDocId));

      setConfidenceBefore(opportunityScore.confidence);
      setConfidenceAfter(opportunityScore.confidence);
      setLearningInsight(null);
      setComparison(null);

      const scored = await Promise.all(
        data.map(async (decision) => {
          const breakdown = await generateOpportunityScore(`${decision.title}\n${decision.justification}\n${doc.content ? JSON.stringify(doc.content) : ""}`);
          const scoreValue = calculateScore(breakdown);
          return {
            ...decision,
            decisionId:
              typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `${currentDocId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            scoreBreakdown: breakdown,
            score: scoreValue,
          } satisfies ScoredDecision;
        })
      );
      setFeedbackByCard({});

      setScoredSuggestions(scored.sort((left, right) => right.score - left.score));

      try {
        await Promise.all(
          scored.map((decision) =>
            saveDecision(user.uid, {
              title: decision.title,
              justification: decision.justification,
              priority: decision.priority,
              impact: decision.impact,
              effort: decision.effort,
              userStory: decision.userStory,
              tradeoffs: decision.tradeoffs,
              strategyTheme: guidance.theme,
            })
          )
        );
      } catch (persistError) {
        console.error("Decision persistence failed:", persistError);
      }
    } catch (error) {
      console.error("Decision generation failed:", error);
      alert("AI decision engine failed to generate suggestions.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveExpectedOutcome = () => {
    if (!currentDocId || !expectedMetric.trim() || !expectedTarget.trim() || !expectedTimeframe.trim()) return;

    const target = Number(expectedTarget);
    if (Number.isNaN(target)) return;

    setExpectedOutcome(currentDocId, expectedMetric.trim(), target, expectedTimeframe.trim());
    const next = getExpectedOutcome(currentDocId);
    setExpectedOutcomeState(next);
  };

  const handleRecordActualOutcome = async () => {
    if (!currentDocId || !actualMetric.trim() || !actualValue.trim()) return;

    const value = Number(actualValue);
    if (Number.isNaN(value)) return;

    recordActualOutcome(currentDocId, actualMetric.trim(), value);
    const actual = getActualOutcome(currentDocId);
    setActualOutcomeState(actual);

    const expected = expectedOutcome;
    if (!expected || !actual) return;

    const nextComparison = compareOutcomes(expected.expected, actual.actual);
    setComparison(nextComparison);

    let confidenceBeforeSnapshot = confidenceBefore;
    let confidenceAfterSnapshot = confidenceAfter;

    if (scoreSummary) {
      const previousConfidence = scoreSummary.confidence;
      const adjusted = updateConfidenceScore({ ...scoreSummary, score: scoreSummary.score }, nextComparison.success);
      const recalculated = calculateScore(adjusted);
      const nextScore = { ...adjusted, score: recalculated, reasoning: scoreSummary.reasoning };
      setScoreSummary(nextScore);
      setConfidenceBefore(previousConfidence);
      setConfidenceAfter(nextScore.confidence);
      confidenceBeforeSnapshot = previousConfidence;
      confidenceAfterSnapshot = nextScore.confidence;

      recordScoreHistory(currentDocId, {
        timestamp: Date.now(),
        score: recalculated,
        breakdown: {
          impact: nextScore.impact,
          effort: nextScore.effort,
          confidence: nextScore.confidence,
          demand: nextScore.demand,
        },
      });
      setScoreHistory(getScoreHistory(currentDocId));
    }

    try {
      const insight = await generateLearningInsight(
        JSON.stringify({ expected: expected.expected, actual: actual.actual, comparison: nextComparison }),
        {
          target_value: String(expected.expected.target_value),
          metric: expected.expected.metric,
          timeframe: expected.expected.timeframe,
        },
        {
          value: String(actual.actual.value),
          metric: actual.actual.metric,
          observedAt: new Date(actual.actual.timestamp).toISOString(),
        }
      );
      setLearningInsight(insight);
      setOutcomeLoop({
        expectedOutcome: expected.expected,
        actualOutcome: actual.actual,
        learningInsight: insight,
        confidenceBefore: confidenceBeforeSnapshot,
        confidenceAfter: confidenceAfterSnapshot,
      });
    } catch (error) {
      console.error("Failed to generate learning insight:", error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-8 h-14 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Decisions</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          onClick={handleGenerate}
          disabled={isLoading || !currentDocId}
        >
          {isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          {isLoading ? "Thinking…" : "What should we build next?"}
        </Button>
      </div>

      <Dialog open={Boolean(prdPreview)} onOpenChange={(open) => {
        if (!open) {
          setPrdPreview(null);
          setPendingDecisionForPRD(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>PRD Preview</DialogTitle>
            <DialogDescription>
              Review the generated PRD before saving it to your library or inserting it into the editor.
            </DialogDescription>
          </DialogHeader>

          {prdPreview && (
            <div className="flex-1 overflow-auto rounded-lg border border-border bg-muted/20 p-4 text-xs whitespace-pre-wrap font-mono leading-relaxed">
              {prdPreview.content}
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={handleInsertPrd} disabled={!prdPreview}>
              Insert Template
            </Button>
            <Button onClick={handleSavePrd} disabled={!prdPreview}>
              Save to PRDs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex-1 overflow-y-auto p-10 space-y-12 max-w-5xl custom-scrollbar">
        {scoreSummary && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <ScoreCard
                score={scoreSummary.score}
                impact={scoreSummary.impact}
                effort={scoreSummary.effort}
                confidence={scoreSummary.confidence}
                demand={scoreSummary.demand}
                reasoning={scoreSummary.reasoning}
              />
            </div>
            <div className="md:col-span-1">
              <BreakdownChart
                impact={scoreSummary.impact}
                effort={scoreSummary.effort}
                confidence={scoreSummary.confidence}
                demand={scoreSummary.demand}
              />
            </div>
            <div className="md:col-span-1">
              <ScoreHistoryGraph history={scoreHistory} />
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1 rounded-2xl border border-border/60 bg-white p-5 shadow-sm">
            <p className="label-system text-[10px] uppercase tracking-widest text-muted-foreground">Expected Outcome</p>
            <div className="mt-4 space-y-3">
              <Input value={expectedMetric} onChange={(e) => setExpectedMetric(e.target.value)} placeholder="Metric (e.g. retention)" />
              <Input value={expectedTarget} onChange={(e) => setExpectedTarget(e.target.value)} placeholder="Target value" />
              <Input value={expectedTimeframe} onChange={(e) => setExpectedTimeframe(e.target.value)} placeholder="Timeframe" />
              <Button onClick={handleSaveExpectedOutcome} className="w-full" variant="outline">Save Expected Outcome</Button>
            </div>
          </div>

          <div className="md:col-span-1 rounded-2xl border border-border/60 bg-white p-5 shadow-sm">
            <p className="label-system text-[10px] uppercase tracking-widest text-muted-foreground">Actual Outcome</p>
            <div className="mt-4 space-y-3">
              <Input value={actualMetric} onChange={(e) => setActualMetric(e.target.value)} placeholder="Metric" />
              <Input value={actualValue} onChange={(e) => setActualValue(e.target.value)} placeholder="Actual value" />
              <Button onClick={handleRecordActualOutcome} className="w-full">Record Actual Outcome</Button>
            </div>
          </div>

          <div className="md:col-span-1">
            <OutcomeCard expected={expectedOutcome} actual={actualOutcome} comparison={comparison} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <LearningInsight insight={learningInsight} />
          <ScoreAdjustment oldConfidence={confidenceBefore} newConfidence={confidenceAfter} />
        </div>

        {strategicGuidance && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.06em] text-primary mb-2">Strategic focus</p>
            <h2 className="text-sm font-semibold text-foreground mb-2">{strategicGuidance.theme}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{strategicGuidance.rationale}</p>
            {strategicGuidance.gaps.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {strategicGuidance.gaps.map((gap) => (
                  <span key={gap} className="text-xs rounded-full border border-primary/20 bg-background px-2 py-0.5">
                    {gap}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {suggestions.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border/60 rounded-xl max-w-lg mx-auto">
            <Target className="h-8 w-8 text-muted-foreground/40 mb-4" />
            <p className="text-sm font-medium mb-1">No decisions yet</p>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mb-6">
              Ask the engine what to build next based on your current notes.
            </p>
            <Button
              onClick={handleGenerate}
              disabled={!currentDocId}
            >
              <Zap className="mr-2 h-3.5 w-3.5" />
              Analyze
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-3">
            <Brain className="h-6 w-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Analyzing context…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {scoredSuggestions.map((s, i) => {
              const health = evaluateDecisionHealth(s);
              const healthStyle = healthStyles[health.status];
              const pushbacks = evaluatePushback(s);
              const isBriefLoading =
                briefDialog.open &&
                briefDialog.loading &&
                briefDialog.decisionId === s.decisionId;
              return (
              <div
                key={i}
                className="flex flex-col bg-background border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors animate-fade-up"
              >
                <div className="p-5 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${healthStyle.pill}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${healthStyle.dot}`} />
                      <span className="font-semibold">{healthLabel[health.status]}</span>
                      <span className="font-mono tabular-nums opacity-90">({s.score})</span>
                      <span className="opacity-70">— {health.reason}</span>
                    </span>
                    <span className={`shrink-0 px-2 py-0.5 rounded border text-[11px] uppercase tracking-[0.06em] ${priorityColors[s.priority]}`}>
                      {s.priority}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold leading-tight tracking-[-0.01em] mb-3">
                    {s.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 border-l-2 border-primary/15 pl-3">
                    {s.justification}
                  </p>
                  <div className="text-xs text-muted-foreground leading-relaxed mb-3">
                    <span className="block text-[10px] uppercase tracking-[0.06em] mb-1 text-muted-foreground/70">Trade-offs</span>
                    {s.tradeoffs}
                  </div>
                  <div className="text-xs text-foreground leading-relaxed bg-muted/40 p-2.5 rounded-md mb-3">
                    <span className="block text-[10px] uppercase tracking-[0.06em] mb-1 text-muted-foreground">User story</span>
                    {s.userStory}
                  </div>
                  {pushbacks.length > 0 && (
                    <div className="space-y-2">
                      {pushbacks.map((pb) => {
                        const isAlert = pb.severity === "alert";
                        const accentCls = isAlert
                          ? "border-l-red-500 bg-red-500/[0.04] text-red-800 dark:text-red-200"
                          : "border-l-amber-500 bg-amber-500/[0.04] text-amber-900 dark:text-amber-200";
                        const Icon = isAlert ? AlertCircle : AlertTriangle;
                        return (
                          <div
                            key={pb.id}
                            className={`rounded-md border-l-2 border-y border-r border-border/40 px-3 py-2 text-xs shadow-sm animate-pushback-flash ${accentCls}`}
                          >
                            <div className="flex items-start gap-2">
                              <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              <p className="flex-1 leading-relaxed font-medium">{pb.message}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handlePushbackCta(pb.cta.action)}
                              className="mt-1.5 ml-5 inline-flex items-center gap-1 text-[11px] font-medium hover:underline underline-offset-2"
                            >
                              {pb.cta.label}
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Compact analytical scoring row */}
                <div className="px-5 py-3 bg-muted/20 border-t border-border/60">
                  <dl className="grid grid-cols-4 gap-x-4">
                    {([
                      ["Impact", s.scoreBreakdown.impact],
                      ["Effort", s.scoreBreakdown.effort],
                      ["Confidence", s.scoreBreakdown.confidence],
                      ["Demand", s.scoreBreakdown.demand],
                    ] as const).map(([label, value]) => (
                      <div key={label} className="flex flex-col items-end">
                        <dt className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground self-start">{label}</dt>
                        <dd className="font-mono text-sm tabular-nums text-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="px-5 pb-5 pt-3 space-y-2">
                  <Button
                    size="sm"
                    className="w-full text-xs font-medium"
                    onClick={() => handleGenerateCaseBrief(s)}
                    disabled={isBriefLoading}
                  >
                    {isBriefLoading ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1.5 h-3 w-3" />}
                    Generate Case Brief
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => convertDecisionToPRD(s, i)}
                    disabled={isGeneratingPRDFor === `${s.title}-${i}`}
                  >
                    {isGeneratingPRDFor === `${s.title}-${i}` ? "Generating PRD…" : "Convert to PRD"}
                  </Button>
                </div>

                {s.score > 0 && (() => {
                  const fb = getFeedbackState(s.decisionId);
                  const canSubmit = fb.expected.trim().length > 0 && fb.actual.trim().length > 0 && !fb.submitting;

                  // State A — not yet shipped: whisper-style "Mark as shipped" button.
                  if (!fb.shipped && !fb.submitted) {
                    return (
                      <div className="px-5 pb-5 pt-3 border-t border-border/60">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full text-xs text-muted-foreground/50 hover:text-foreground"
                          onClick={() => updateFeedbackState(s.decisionId, { shipped: true })}
                        >
                          Mark as shipped
                        </Button>
                      </div>
                    );
                  }

                  // State C — submitted: show AI insight and confidence delta.
                  if (fb.submitted) {
                    return (
                      <div className="px-5 pb-5 pt-3 border-t border-border/60 space-y-3">
                        <span className="block text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                          How did this go?
                        </span>
                        <div className="space-y-2">
                          {fb.insight && (
                            <p className="text-xs text-foreground leading-relaxed bg-muted/40 p-2.5 rounded-md whitespace-pre-wrap">
                              {fb.insight}
                            </p>
                          )}
                          {fb.confidenceBefore !== undefined && fb.confidenceAfter !== undefined && (
                            <div className="text-xs text-muted-foreground">
                              Confidence {fb.confidenceBefore} → <span className="text-foreground font-medium">{fb.confidenceAfter}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // State B — shipped, awaiting feedback.
                  const shippedDate = new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  return (
                    <div className="px-5 pb-5 pt-3 border-t border-border/60 space-y-3">
                      <span className="block text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                        How did this go?
                      </span>
                      <p className="text-[11px] text-muted-foreground/50 mb-2">Shipped on {shippedDate}</p>
                      <Input
                        value={fb.expected}
                        onChange={(e) => updateFeedbackState(s.decisionId, { expected: e.target.value })}
                        placeholder="Expected: 20% retention lift"
                        disabled={fb.submitting}
                      />
                      <Input
                        value={fb.actual}
                        onChange={(e) => updateFeedbackState(s.decisionId, { actual: e.target.value })}
                        placeholder="Actual: 8% lift"
                        disabled={fb.submitting}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={() => handleSubmitFeedback(s, true)}
                          disabled={!canSubmit}
                        >
                          {fb.submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                          Shipped & worked
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={() => handleSubmitFeedback(s, false)}
                          disabled={!canSubmit}
                        >
                          {fb.submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                          Didn&apos;t pan out
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
              );
            })}
          </div>
        )}
      </div>

      <CaseBriefDialog
        open={briefDialog.open}
        loading={briefDialog.loading}
        data={briefDialog.data}
        error={briefDialog.error}
        onClose={() => setBriefDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
