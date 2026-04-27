"use client";

import React from "react";
import { Compass, Sparkles, Loader2, Zap, Brain, Search, Lightbulb, AlertTriangle } from "lucide-react";
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
import { DecisionHeaderCard } from "@/components/decision/DecisionHeaderCard";
import { DecisionCardV2 } from "@/components/decision/DecisionCardV2";
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

type DecisionFilter = "all" | "strong" | "risky" | "recent";

const filterChips: ReadonlyArray<{ id: DecisionFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "strong", label: "Strong" },
  { id: "risky", label: "Risky" },
  { id: "recent", label: "Recent" },
];

const groupOrder: ReadonlyArray<{ status: HealthStatus; label: string; subtitle: string; accentCls: string; dotCls: string }> = [
  {
    status: "healthy",
    label: "Strong Decisions",
    subtitle: "Well-supported, ship-ready",
    accentCls: "text-emerald-700 dark:text-emerald-300",
    dotCls: "bg-emerald-500",
  },
  {
    status: "risky",
    label: "Needs Validation",
    subtitle: "Thin evidence or imbalanced trade-offs",
    accentCls: "text-amber-700 dark:text-amber-300",
    dotCls: "bg-amber-500",
  },
  {
    status: "weak",
    label: "Risky Decisions",
    subtitle: "Deal-breakers — gather evidence first",
    accentCls: "text-red-700 dark:text-red-300",
    dotCls: "bg-red-500",
  },
];

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
  const [filter, setFilter] = React.useState<DecisionFilter>("all");
  const [searchTerm, setSearchTerm] = React.useState("");

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
          <DecisionHeaderCard
            score={scoreSummary.score}
            impact={scoreSummary.impact}
            effort={scoreSummary.effort}
            confidence={scoreSummary.confidence}
            demand={scoreSummary.demand}
            reasoning={scoreSummary.reasoning}
            priority={scoredSuggestions[0]?.priority}
            title={scoredSuggestions[0]?.title}
            history={scoreHistory}
          />
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
          <section className="rounded-2xl border border-border/60 bg-white p-5 shadow-sm">
            <header className="flex items-center gap-2">
              <span aria-hidden className="text-base">🎯</span>
              <p className="text-[10px] uppercase tracking-[0.08em] font-medium text-primary">Strategic Focus</p>
            </header>

            <h2 className="mt-2 text-base font-semibold tracking-tight text-foreground">
              {strategicGuidance.theme}
            </h2>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground mb-1">Why it matters</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{strategicGuidance.rationale}</p>
              </div>

              {strategicGuidance.gaps.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground mb-1.5">Risks &amp; gaps</p>
                  <ul className="space-y-1">
                    {strategicGuidance.gaps.map((gap) => (
                      <li key={gap} className="flex items-start gap-2 text-sm text-foreground/90">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <span className="leading-relaxed">{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {suggestions.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border/60 rounded-2xl max-w-lg mx-auto bg-white/40">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <p className="text-base font-semibold tracking-tight mb-1">No decisions yet</p>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">
              Start analyzing your first product choice — Buildcase will score, group, and challenge your direction.
            </p>
            <Button onClick={handleGenerate} disabled={!currentDocId}>
              <Zap className="mr-2 h-3.5 w-3.5" />
              Create Decision
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/60 bg-white p-5 shadow-sm animate-pulse"
              >
                <div className="h-6 w-24 rounded-full bg-muted/60" />
                <div className="mt-4 h-5 w-3/4 rounded bg-muted/60" />
                <div className="mt-2 h-3 w-full rounded bg-muted/40" />
                <div className="mt-1 h-3 w-5/6 rounded bg-muted/40" />
                <div className="mt-5 grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((j) => (
                    <div key={j} className="h-8 rounded bg-muted/40" />
                  ))}
                </div>
                <div className="mt-4 h-8 w-full rounded bg-muted/40" />
              </div>
            ))}
            <div className="col-span-full flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
              <Brain className="h-3.5 w-3.5 animate-pulse" />
              Analyzing context…
            </div>
          </div>
        ) : (
          <DecisionGrid
            scoredSuggestions={scoredSuggestions}
            filter={filter}
            setFilter={setFilter}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            briefDialog={briefDialog}
            isGeneratingPRDFor={isGeneratingPRDFor}
            onGenerateBrief={handleGenerateCaseBrief}
            onConvertToPRD={convertDecisionToPRD}
            onPushbackCta={handlePushbackCta}
            getFeedbackState={getFeedbackState}
            updateFeedbackState={updateFeedbackState}
            onSubmitFeedback={handleSubmitFeedback}
          />
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

interface DecisionGridProps {
  scoredSuggestions: ScoredDecision[];
  filter: DecisionFilter;
  setFilter: (filter: DecisionFilter) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  briefDialog: { open: boolean; loading: boolean; decisionId: string | null };
  isGeneratingPRDFor: string | null;
  onGenerateBrief: (decision: ScoredDecision) => void;
  onConvertToPRD: (decision: ScoredDecision, index: number) => void;
  onPushbackCta: (action: PushbackAction) => void;
  getFeedbackState: (decisionId: string) => FeedbackCardState;
  updateFeedbackState: (decisionId: string, patch: Partial<FeedbackCardState>) => void;
  onSubmitFeedback: (decision: ScoredDecision, success: boolean) => void;
}

function DecisionGrid({
  scoredSuggestions,
  filter,
  setFilter,
  searchTerm,
  setSearchTerm,
  briefDialog,
  isGeneratingPRDFor,
  onGenerateBrief,
  onConvertToPRD,
  onPushbackCta,
  getFeedbackState,
  updateFeedbackState,
  onSubmitFeedback,
}: DecisionGridProps) {
  // Annotate every decision with its evaluated health + pushbacks once, so
  // grouping, filtering, and rendering all share the same judgment.
  const annotated = React.useMemo(
    () =>
      scoredSuggestions.map((decision, index) => ({
        decision,
        index,
        health: evaluateDecisionHealth(decision),
        pushbacks: evaluatePushback(decision),
      })),
    [scoredSuggestions]
  );

  const search = searchTerm.trim().toLowerCase();
  const filtered = annotated.filter(({ decision, health }) => {
    if (filter === "strong" && health.status !== "healthy") return false;
    if (filter === "risky" && health.status === "healthy") return false;
    // "recent" = top of the input order (already sorted by score desc upstream).
    // We don't have per-decision timestamps, so this filter is a no-op on data
    // and just re-renders without the grouping below.
    if (search) {
      const haystack = `${decision.title} ${decision.justification} ${decision.tradeoffs}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const grouped = React.useMemo(() => {
    const map: Record<HealthStatus, typeof filtered> = { healthy: [], risky: [], weak: [] };
    for (const item of filtered) {
      map[item.health.status].push(item);
    }
    return map;
  }, [filtered]);

  const renderFeedbackFooter = (decision: ScoredDecision): React.ReactNode => {
    if (decision.score <= 0) return null;
    const fb = getFeedbackState(decision.decisionId);
    const canSubmit = fb.expected.trim().length > 0 && fb.actual.trim().length > 0 && !fb.submitting;

    if (!fb.shipped && !fb.submitted) {
      return (
        <div className="px-5 pb-4 pt-3 border-t border-border/60">
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-xs text-muted-foreground/60 hover:text-foreground"
            onClick={() => updateFeedbackState(decision.decisionId, { shipped: true })}
          >
            Mark as shipped
          </Button>
        </div>
      );
    }

    if (fb.submitted) {
      return (
        <div className="px-5 pb-4 pt-3 border-t border-border/60 space-y-2">
          <span className="block text-[10px] uppercase tracking-[0.06em] text-muted-foreground">How did this go?</span>
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
      );
    }

    const shippedDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return (
      <div className="px-5 pb-4 pt-3 border-t border-border/60 space-y-2">
        <span className="block text-[10px] uppercase tracking-[0.06em] text-muted-foreground">How did this go?</span>
        <p className="text-[11px] text-muted-foreground/60">Shipped on {shippedDate}</p>
        <Input
          value={fb.expected}
          onChange={(e) => updateFeedbackState(decision.decisionId, { expected: e.target.value })}
          placeholder="Expected: 20% retention lift"
          disabled={fb.submitting}
        />
        <Input
          value={fb.actual}
          onChange={(e) => updateFeedbackState(decision.decisionId, { actual: e.target.value })}
          placeholder="Actual: 8% lift"
          disabled={fb.submitting}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={() => onSubmitFeedback(decision, true)}
            disabled={!canSubmit}
          >
            {fb.submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Shipped &amp; worked
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={() => onSubmitFeedback(decision, false)}
            disabled={!canSubmit}
          >
            {fb.submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Didn&apos;t pan out
          </Button>
        </div>
      </div>
    );
  };

  const totalAnnotated = annotated.length;
  const totalFiltered = filtered.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search decisions..."
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-white p-1 shadow-sm">
          {filterChips.map((chip) => {
            const active = filter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilter(chip.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {totalFiltered === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-white/40 p-12 text-center">
          <p className="text-sm font-medium">No decisions match this filter</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalAnnotated} total · try a different filter or clear your search.
          </p>
        </div>
      )}

      {groupOrder.map(({ status, label, subtitle, accentCls, dotCls }) => {
        const items = grouped[status];
        if (items.length === 0) return null;

        return (
          <section key={status} className="space-y-4">
            <header className="flex items-baseline justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${dotCls}`} />
                <h2 className={`text-sm font-semibold tracking-tight ${accentCls}`}>{label}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">({items.length})</span>
              </div>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {items.map(({ decision, index, health, pushbacks }) => {
                const isBriefLoading =
                  briefDialog.open && briefDialog.loading && briefDialog.decisionId === decision.decisionId;
                const isConverting = isGeneratingPRDFor === `${decision.title}-${index}`;
                return (
                  <DecisionCardV2
                    key={decision.decisionId}
                    title={decision.title}
                    summary={decision.justification}
                    score={decision.score}
                    health={health}
                    priority={decision.priority}
                    metrics={{
                      impact: decision.scoreBreakdown.impact,
                      effort: decision.scoreBreakdown.effort,
                      confidence: decision.scoreBreakdown.confidence,
                      demand: decision.scoreBreakdown.demand,
                    }}
                    pushbacks={pushbacks}
                    onPushbackCta={onPushbackCta}
                    onGenerateBrief={() => onGenerateBrief(decision)}
                    onConvert={() => onConvertToPRD(decision, index)}
                    isBriefLoading={isBriefLoading}
                    isConverting={isConverting}
                    footer={renderFeedbackFooter(decision)}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
