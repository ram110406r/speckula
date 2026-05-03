"use client";

import React from "react";
import { Compass, Sparkles, Loader2, Zap, Brain, Search, Lightbulb, AlertTriangle, Download, Plus, Pencil, X } from "lucide-react";
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
import { getDocument, saveDecision, savePRD, deleteDecision, getDecisions, updateDecision } from "@/lib/firebase/db";
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
import { downloadMarkdown, downloadCSV, generateDecisionsMarkdown } from "@/lib/export";
import { toast } from "@/store/useToastStore";
import { exportDialog } from "@/store/useExportDialogStore";
import { activity } from "@/store/useActivityStore";
import { CaseBriefDialog } from "@/components/decision/CaseBriefDialog";
import { FocusPanel, type FocusPanelData } from "@/components/decision/FocusPanel";

type DecisionFilter = "all" | "strong" | "risky" | "recent";

const filterChips: ReadonlyArray<{ id: DecisionFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "strong", label: "Strong" },
  { id: "risky", label: "Risky" },
  { id: "recent", label: "Recent" },
];

const groupOrder: ReadonlyArray<{ status: HealthStatus; label: string; subtitle: string; accentCls: string; dotCls: string }> = [
  { status: "healthy", label: "Strong Decisions",    subtitle: "Well-supported, ship-ready",                   accentCls: "text-success",     dotCls: "bg-success"     },
  { status: "risky",   label: "Needs Validation",    subtitle: "Thin evidence or imbalanced trade-offs",       accentCls: "text-warning",     dotCls: "bg-warning"     },
  { status: "weak",    label: "Risky Decisions",     subtitle: "Deal-breakers — gather evidence first",        accentCls: "text-destructive", dotCls: "bg-destructive" },
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

// ── Manual decision form state ─────────────────────────────────────────────────
interface DecisionFormState {
  title: string;
  priority: "high" | "medium" | "low";
  justification: string;
  userStory: string;
  tradeoffs: string;
  impact: string;
  effort: string;
  confidence: string;
  demand: string;
}

const emptyForm = (): DecisionFormState => ({
  title: "", priority: "medium", justification: "",
  userStory: "", tradeoffs: "", impact: "6", effort: "5", confidence: "5", demand: "5",
});

function formFromDecision(d: ScoredDecision): DecisionFormState {
  return {
    title: d.title,
    priority: d.priority,
    justification: d.justification,
    userStory: d.userStory ?? "",
    tradeoffs: d.tradeoffs ?? "",
    impact: String(d.scoreBreakdown.impact),
    effort: String(d.scoreBreakdown.effort),
    confidence: String(d.scoreBreakdown.confidence),
    demand: String(d.scoreBreakdown.demand),
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DecisionView() {
  const { user } = useAuth();
  const { currentDocId, setPendingInsertion, setActiveView, setPendingDecisionForPRD, setOutcomeLoop } = useAppStore();
  const [suggestions, setSuggestions] = React.useState<DecisionSuggestion[]>([]);
  const [scoredSuggestions, setScoredSuggestions] = React.useState<ScoredDecision[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSavingManual, setIsSavingManual] = React.useState(false);
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
    open: boolean; loading: boolean; data: CaseBriefData | null; error: string | null; decisionId: string | null;
  }>({ open: false, loading: false, data: null, error: null, decisionId: null });
  const [filter, setFilter] = React.useState<DecisionFilter>("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [focusPanelData, setFocusPanelData] = React.useState<FocusPanelData | null>(null);

  // Manual create / edit dialog
  const [decisionForm, setDecisionForm] = React.useState<DecisionFormState | null>(null);
  const [editingDecisionId, setEditingDecisionId] = React.useState<string | null>(null);

  // ── Load saved decisions from Firestore ──────────────────────────────────────
  React.useEffect(() => {
    if (!user || !currentDocId) return;
    (async () => {
      try {
        const records = await getDecisions(user.uid);
        const forDoc = records.filter((r) => r.sourceDocId === currentDocId);
        if (forDoc.length === 0) return;
        const scored: ScoredDecision[] = forDoc.map((r) => {
          const breakdown: OpportunityScoreData = {
            impact: r.impact,
            effort: r.effort,
            confidence: r.confidence ?? 5,
            demand: r.demand ?? 5,
            reasoning: r.reasoning ?? "",
          };
          return {
            decisionId: r.id!,
            title: r.title,
            justification: r.justification,
            priority: r.priority,
            impact: r.impact,
            effort: r.effort,
            userStory: r.userStory,
            tradeoffs: r.tradeoffs,
            summary: r.summary,
            keyInsight: r.keyInsight,
            recommendation: r.recommendation,
            risks: r.risks,
            score: r.score ?? calculateScore(breakdown),
            scoreBreakdown: breakdown,
          } as ScoredDecision;
        });
        setScoredSuggestions(scored);
        setSuggestions(scored); // keeps "no decisions" empty state accurate
      } catch {
        // silent — first load failure is non-critical
      }
    })();
  }, [user, currentDocId]);

  React.useEffect(() => {
    if (currentDocId) {
      setScoreHistory(getScoreHistory(currentDocId));
      setExpectedOutcomeState(getExpectedOutcome(currentDocId));
      setActualOutcomeState(getActualOutcome(currentDocId));
    }
  }, [currentDocId]);

  // ── Feedback helpers ─────────────────────────────────────────────────────────
  const getFeedbackState = (decisionId: string): FeedbackCardState =>
    feedbackByCard[decisionId] ?? { expected: "", actual: "", submitting: false, submitted: false, shipped: false };

  const updateFeedbackState = (decisionId: string, patch: Partial<FeedbackCardState>) => {
    setFeedbackByCard((prev) => ({ ...prev, [decisionId]: { ...getFeedbackState(decisionId), ...patch } }));
  };

  // ── Case brief ───────────────────────────────────────────────────────────────
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
      activity.ai("Case brief ready", decision.title);
    } catch (error) {
      setBriefDialog({
        open: true, loading: false, data: null,
        error: error instanceof Error ? error.message : "Failed to draft brief.",
        decisionId: decision.decisionId,
      });
    }
  };

  // ── Pushback CTA ─────────────────────────────────────────────────────────────
  const handlePushbackCta = (action: PushbackAction) => {
    if (action === "add-evidence") { setActiveView("editor"); return; }
    if (action === "rescore") handleGenerate();
  };

  // ── Outcome feedback ─────────────────────────────────────────────────────────
  const handleSubmitFeedback = async (decision: ScoredDecision, success: boolean) => {
    const state = getFeedbackState(decision.decisionId);
    if (state.submitting || state.submitted || !state.expected.trim() || !state.actual.trim()) return;
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
        { decisionId: decision.decisionId, success,
          expected: { target_value: Number(state.expected), metric: "", timeframe: "" },
          actual: { value: Number(state.actual), metric: "", observedAt: new Date().toISOString() } },
        currentScore
      );
      setScoredSuggestions((prev) =>
        prev.map((d) => d.decisionId !== decision.decisionId ? d : {
          ...d, score: updatedScore.score,
          scoreBreakdown: { ...d.scoreBreakdown, impact: updatedScore.impact, effort: updatedScore.effort, confidence: updatedScore.confidence, demand: updatedScore.demand },
        })
      );
      updateFeedbackState(decision.decisionId, { submitting: false, submitted: true, insight, confidenceBefore: previousConfidence, confidenceAfter: updatedScore.confidence });
    } catch {
      updateFeedbackState(decision.decisionId, { submitting: false });
    }
  };

  // ── AI generate ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!user || !currentDocId || isLoading) return;
    setIsLoading(true);
    try {
      const doc = await getDocument(user.uid, currentDocId);
      if (!doc?.content) {
        toast.warning("Document is empty", "Add some product notes first.");
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
      recordScoreHistory(currentDocId, { timestamp: Date.now(), score, breakdown: { impact: scoreData.impact, effort: scoreData.effort, confidence: scoreData.confidence, demand: scoreData.demand } });
      setScoreHistory(getScoreHistory(currentDocId));
      setConfidenceBefore(opportunityScore.confidence);
      setConfidenceAfter(opportunityScore.confidence);
      setLearningInsight(null);
      setComparison(null);

      const scored: ScoredDecision[] = await Promise.all(
        data.map(async (decision) => {
          const breakdown = await generateOpportunityScore(`${decision.title}\n${decision.justification}\n${doc.content ? JSON.stringify(doc.content) : ""}`);
          const scoreValue = calculateScore(breakdown);
          let persistedId: string;
          try {
            persistedId = await saveDecision(user.uid, {
              title: decision.title,
              justification: decision.justification,
              priority: decision.priority,
              impact: breakdown.impact,
              effort: breakdown.effort,
              confidence: breakdown.confidence,
              demand: breakdown.demand,
              score: scoreValue,
              reasoning: breakdown.reasoning,
              summary: decision.summary,
              keyInsight: decision.keyInsight,
              recommendation: decision.recommendation,
              risks: decision.risks,
              userStory: decision.userStory,
              tradeoffs: decision.tradeoffs,
              strategyTheme: guidance.theme,
              sourceDocId: currentDocId ?? undefined,
            });
          } catch (persistError) {
            console.error("Decision persistence failed:", persistError);
            persistedId = typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `${currentDocId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          }
          return { ...decision, decisionId: persistedId, scoreBreakdown: breakdown, score: scoreValue } satisfies ScoredDecision;
        })
      );
      setFeedbackByCard({});
      setScoredSuggestions(scored.sort((a, b) => b.score - a.score));
      activity.ai("Decisions analyzed", `${scored.length} decision${scored.length !== 1 ? "s" : ""} scored`);
    } catch (error) {
      console.error("Decision generation failed:", error);
      toast.error("AI decision engine failed", "Check your API key and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Manual decision create/edit ──────────────────────────────────────────────
  const openNewDecision = () => {
    setEditingDecisionId(null);
    setDecisionForm(emptyForm());
  };

  const openEditDecision = (d: ScoredDecision) => {
    setEditingDecisionId(d.decisionId);
    setDecisionForm(formFromDecision(d));
  };

  const handleSaveDecisionForm = async () => {
    if (!user || !decisionForm || !decisionForm.title.trim()) return;
    setIsSavingManual(true);
    try {
      const impact = Math.min(10, Math.max(1, Number(decisionForm.impact) || 6));
      const effort = Math.min(10, Math.max(1, Number(decisionForm.effort) || 5));
      const confidence = Math.min(10, Math.max(1, Number(decisionForm.confidence) || 5));
      const demand = Math.min(10, Math.max(1, Number(decisionForm.demand) || 5));
      const breakdown: OpportunityScoreData = { impact, effort, confidence, demand, reasoning: "" };
      const scoreValue = calculateScore(breakdown);

      const payload = {
        title: decisionForm.title.trim(),
        justification: decisionForm.justification.trim(),
        priority: decisionForm.priority,
        impact, effort, confidence, demand, score: scoreValue,
        userStory: decisionForm.userStory.trim(),
        tradeoffs: decisionForm.tradeoffs.trim(),
        sourceDocId: currentDocId ?? undefined,
      };

      if (editingDecisionId) {
        await updateDecision(user.uid, editingDecisionId, payload);
        setScoredSuggestions((prev) => prev.map((d) => d.decisionId !== editingDecisionId ? d : {
          ...d, ...payload, scoreBreakdown: breakdown, score: scoreValue,
        }));
        toast.success("Decision updated");
      } else {
        const id = await saveDecision(user.uid, payload);
        const newDecision: ScoredDecision = {
          decisionId: id,
          title: payload.title,
          justification: payload.justification,
          priority: payload.priority,
          impact, effort,
          userStory: payload.userStory,
          tradeoffs: payload.tradeoffs,
          score: scoreValue,
          scoreBreakdown: breakdown,
        };
        setScoredSuggestions((prev) => [newDecision, ...prev]);
        setSuggestions((prev) => [newDecision as unknown as DecisionSuggestion, ...prev]);
        toast.success("Decision added");
        activity.success("Decision added", payload.title);
      }
      setDecisionForm(null);
      setEditingDecisionId(null);
    } catch {
      toast.error("Failed to save decision");
    } finally {
      setIsSavingManual(false);
    }
  };

  // ── Convert to PRD ───────────────────────────────────────────────────────────
  const convertDecisionToPRD = async (decision: DecisionSuggestion, index: number) => {
    if (!user) return;
    const key = `${decision.title}-${index}`;
    setIsGeneratingPRDFor(key);
    try {
      const prdMarkdown = await generatePRDFromDecisionAction(decision);
      setPendingDecisionForPRD({ title: decision.title, priority: decision.priority, userStory: decision.userStory, tradeoffs: decision.tradeoffs });
      setPrdPreview({ title: decision.title, content: prdMarkdown, decision });
    } catch {
      toast.error("Failed to generate PRD from this decision.");
    } finally {
      setIsGeneratingPRDFor(null);
    }
  };

  const handleSavePrd = async () => {
    if (!user || !prdPreview) return;
    try {
      await savePRD(user.uid, { title: `PRD: ${prdPreview.title}`, content: prdPreview.content, status: "draft", sourceDocId: currentDocId ?? undefined });
      setPrdPreview(null);
      setPendingDecisionForPRD(null);
      setActiveView("prds");
      toast.success("PRD saved", "Saved to your PRD library.");
      activity.success("PRD saved", `PRD: ${prdPreview.title}`);
    } catch {
      toast.error("Failed to save PRD");
    }
  };

  const handleInsertPrd = () => {
    if (!prdPreview) return;
    setPendingInsertion(prdPreview.content);
    setPrdPreview(null);
    setPendingDecisionForPRD(null);
    setActiveView("editor");
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDeleteDecision = async (decisionId: string) => {
    if (!user) return;
    try {
      await deleteDecision(user.uid, decisionId);
      setScoredSuggestions((prev) => prev.filter((d) => d.decisionId !== decisionId));
      toast.success("Decision deleted");
    } catch {
      toast.error("Failed to delete decision");
    }
  };

  // ── Outcome tracking ─────────────────────────────────────────────────────────
  const handleSaveExpectedOutcome = () => {
    if (!currentDocId || !expectedMetric.trim() || !expectedTarget.trim() || !expectedTimeframe.trim()) return;
    const target = Number(expectedTarget);
    if (Number.isNaN(target)) return;
    setExpectedOutcome(currentDocId, expectedMetric.trim(), target, expectedTimeframe.trim());
    setExpectedOutcomeState(getExpectedOutcome(currentDocId));
    toast.success("Expected outcome saved");
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
      recordScoreHistory(currentDocId, { timestamp: Date.now(), score: recalculated, breakdown: { impact: nextScore.impact, effort: nextScore.effort, confidence: nextScore.confidence, demand: nextScore.demand } });
      setScoreHistory(getScoreHistory(currentDocId));
    }
    try {
      const insight = await generateLearningInsight({
        decisionLabel: scoreSummary?.reasoning?.slice(0, 80) || expected.expected.metric,
        contextNarrative: JSON.stringify({ expected: expected.expected, actual: actual.actual, comparison: nextComparison }),
        expected: { metric: expected.expected.metric, target_value: Number(expected.expected.target_value), timeframe: expected.expected.timeframe },
        actual: { metric: actual.actual.metric, value: Number(actual.actual.value), observedAt: new Date().toISOString() },
      });
      setLearningInsight(insight);
      setOutcomeLoop({ expectedOutcome: expected.expected, actualOutcome: actual.actual, learningInsight: insight, confidenceBefore: confidenceBeforeSnapshot, confidenceAfter: confidenceAfterSnapshot });
      toast.success("Outcome recorded", "Learning insight generated.");
    } catch {
      toast.error("Failed to generate learning insight");
    }
  };

  // ── Export ───────────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (scoredSuggestions.length === 0) { toast.warning("No decisions to export"); return; }
    exportDialog.open({
      defaultFilename: "decisions",
      formats: [
        { value: "md",  label: "Markdown (.md)"        },
        { value: "csv", label: "Spreadsheet (.csv)"    },
      ],
      onExport: (filename, format) => {
        if (format === "md") {
          const exportable = scoredSuggestions.map((d) => ({
            title: d.title, priority: d.priority, score: d.score,
            justification: d.justification, userStory: d.userStory, tradeoffs: d.tradeoffs,
            impact: d.scoreBreakdown.impact, effort: d.scoreBreakdown.effort,
            confidence: d.scoreBreakdown.confidence, demand: d.scoreBreakdown.demand,
            health: evaluateDecisionHealth(d).status,
          }));
          downloadMarkdown(generateDecisionsMarkdown(exportable), filename);
        } else {
          const header = ["Title", "Priority", "Impact", "Effort", "Confidence", "Demand", "Score", "Justification", "Tradeoffs"];
          const rows = scoredSuggestions.map((d) => [d.title, d.priority ?? "", d.scoreBreakdown?.impact ?? "", d.scoreBreakdown?.effort ?? "", d.scoreBreakdown?.confidence ?? "", d.scoreBreakdown?.demand ?? "", d.score ?? "", d.justification ?? "", d.tradeoffs ?? ""]);
          downloadCSV([header, ...rows], filename);
        }
        toast.success("Decisions exported", `${scoredSuggestions.length} decisions saved as .${format}`);
      },
    });
  };

  const hasDecisions = scoredSuggestions.length > 0;
  const hasOutcomeData = learningInsight !== null || confidenceBefore > 0 || comparison !== null;

  return (
    <div className="flex flex-col h-full bg-background transition-all duration-300">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 md:px-8 h-14 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Decisions</span>
          {hasDecisions && (
            <span className="font-mono text-[10px] text-muted-foreground/60 ml-1">
              {scoredSuggestions.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={handleExport} disabled={!hasDecisions} title="Export">
            <Download className="h-3.5 w-3.5" /><span className="hidden sm:inline ml-1.5">Export</span>
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={openNewDecision} disabled={!currentDocId} title={!currentDocId ? "Select a document first" : "New Decision"}>
            <Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline ml-1.5">New Decision</span>
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={handleGenerate} disabled={isLoading || !currentDocId} title={isLoading ? "Thinking…" : "AI Analyze"}>
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline ml-1.5">{isLoading ? "Thinking…" : "AI Analyze"}</span>
          </Button>
        </div>
      </div>

      {/* PRD Preview Dialog */}
      <Dialog open={Boolean(prdPreview)} onOpenChange={(open) => { if (!open) { setPrdPreview(null); setPendingDecisionForPRD(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>PRD Preview</DialogTitle>
            <DialogDescription>Review the generated PRD before saving it to your library or inserting it into the editor.</DialogDescription>
          </DialogHeader>
          {prdPreview && (
            <div className="flex-1 overflow-auto rounded-lg border border-border bg-muted/20 p-4 text-xs whitespace-pre-wrap font-mono leading-relaxed">
              {prdPreview.content}
            </div>
          )}
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={handleInsertPrd} disabled={!prdPreview}>Insert into Editor</Button>
            <Button onClick={handleSavePrd} disabled={!prdPreview}>Save to PRDs</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New / Edit Decision Dialog */}
      <Dialog open={decisionForm !== null} onOpenChange={(open) => { if (!open) { setDecisionForm(null); setEditingDecisionId(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDecisionId ? "Edit Decision" : "New Decision"}</DialogTitle>
            <DialogDescription>{editingDecisionId ? "Update this decision's details and metrics." : "Manually record a product decision."}</DialogDescription>
          </DialogHeader>
          {decisionForm && (
            <div className="space-y-4 py-1">
              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Title *</label>
                <input
                  autoFocus
                  value={decisionForm.title}
                  onChange={(e) => setDecisionForm((f) => f && ({ ...f, title: e.target.value }))}
                  placeholder="What are we deciding?"
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                />
              </div>
              {/* Priority */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Priority</label>
                <select
                  value={decisionForm.priority}
                  onChange={(e) => setDecisionForm((f) => f && ({ ...f, priority: e.target.value as "high" | "medium" | "low" }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              {/* Justification */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Justification *</label>
                <textarea
                  value={decisionForm.justification}
                  onChange={(e) => setDecisionForm((f) => f && ({ ...f, justification: e.target.value }))}
                  placeholder="Why are we making this decision?"
                  rows={3}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none"
                />
              </div>
              {/* User story */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground">User Story</label>
                <textarea
                  value={decisionForm.userStory}
                  onChange={(e) => setDecisionForm((f) => f && ({ ...f, userStory: e.target.value }))}
                  placeholder="As a… I want… So that…"
                  rows={2}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none"
                />
              </div>
              {/* Trade-offs */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Trade-offs</label>
                <textarea
                  value={decisionForm.tradeoffs}
                  onChange={(e) => setDecisionForm((f) => f && ({ ...f, tradeoffs: e.target.value }))}
                  placeholder="What are we giving up?"
                  rows={2}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none"
                />
              </div>
              {/* Metrics row */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Scoring Metrics (1–10)</label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {(["impact", "effort", "confidence", "demand"] as const).map((key) => (
                    <div key={key}>
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1 block capitalize">{key}</label>
                      <input
                        type="number" min="1" max="10"
                        value={decisionForm[key]}
                        onChange={(e) => setDecisionForm((f) => f && ({ ...f, [key]: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground/50 mt-2">Score is auto-calculated from these values.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => { setDecisionForm(null); setEditingDecisionId(null); }} disabled={isSavingManual}>Cancel</Button>
            <Button size="sm" onClick={handleSaveDecisionForm} disabled={!decisionForm?.title.trim() || !decisionForm?.justification.trim() || isSavingManual}>
              {isSavingManual ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {editingDecisionId ? "Save Changes" : "Add Decision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main scroll area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-10 max-w-5xl mx-auto w-full custom-scrollbar">

        {/* Score header — only once AI has run */}
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
            keyInsight={scoredSuggestions[0]?.keyInsight}
            recommendation={scoredSuggestions[0]?.recommendation}
          />
        )}

        {/* Strategic guidance — only once AI has run */}
        {strategicGuidance && (
          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <header className="flex items-center gap-2">
              <p className="text-[10px] uppercase tracking-[0.08em] font-medium text-primary">Strategic Focus</p>
            </header>
            <h2 className="mt-2 text-base font-semibold tracking-tight text-foreground">{strategicGuidance.theme}</h2>
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
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                        <span className="leading-relaxed">{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Decision grid — empty state / loading / cards */}
        {!hasDecisions && !isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border/60 rounded-2xl max-w-lg mx-auto bg-card/40">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <p className="text-base font-semibold tracking-tight mb-1">No decisions yet</p>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">
              Let AI analyze your document and suggest scored decisions, or add one manually.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={openNewDecision} disabled={!currentDocId}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add manually
              </Button>
              <Button onClick={handleGenerate} disabled={!currentDocId || isLoading}>
                <Zap className="mr-2 h-3.5 w-3.5" /> AI Analyze
              </Button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm animate-pulse">
                <div className="h-6 w-24 rounded-full bg-muted/60" />
                <div className="mt-4 h-5 w-3/4 rounded bg-muted/60" />
                <div className="mt-2 h-3 w-full rounded bg-muted/40" />
                <div className="mt-1 h-3 w-5/6 rounded bg-muted/40" />
                <div className="mt-5 grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((j) => <div key={j} className="h-8 rounded bg-muted/40" />)}
                </div>
                <div className="mt-4 h-8 w-full rounded bg-muted/40" />
              </div>
            ))}
            <div className="col-span-full flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
              <Brain className="h-3.5 w-3.5 animate-pulse" /> Analyzing context…
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
            onFocusDecision={setFocusPanelData}
            onDeleteDecision={handleDeleteDecision}
            onEditDecision={openEditDecision}
          />
        )}

        {/* Outcome tracking — only when decisions exist */}
        {hasDecisions && (
          <section className="space-y-6 pt-4 border-t border-border/40">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Outcome Tracking</h2>
              <span className="text-xs text-muted-foreground">— record what happened after shipping</span>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* Expected outcome form */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Expected Outcome</p>
                <div className="space-y-3">
                  <Input value={expectedMetric} onChange={(e) => setExpectedMetric(e.target.value)} placeholder="Metric (e.g. retention)" />
                  <Input value={expectedTarget} onChange={(e) => setExpectedTarget(e.target.value)} placeholder="Target value" />
                  <Input value={expectedTimeframe} onChange={(e) => setExpectedTimeframe(e.target.value)} placeholder="Timeframe (e.g. 30 days)" />
                  <Button onClick={handleSaveExpectedOutcome} className="w-full" variant="outline" size="sm"
                    disabled={!expectedMetric.trim() || !expectedTarget.trim() || !expectedTimeframe.trim()}>
                    Save Expected Outcome
                  </Button>
                </div>
              </div>

              {/* Actual outcome form */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Actual Outcome</p>
                <div className="space-y-3">
                  <Input value={actualMetric} onChange={(e) => setActualMetric(e.target.value)} placeholder="Metric" />
                  <Input value={actualValue} onChange={(e) => setActualValue(e.target.value)} placeholder="Actual value" />
                  <Button onClick={handleRecordActualOutcome} className="w-full" size="sm"
                    disabled={!actualMetric.trim() || !actualValue.trim()}>
                    Record Actual Outcome
                  </Button>
                </div>
              </div>

              <OutcomeCard expected={expectedOutcome} actual={actualOutcome} comparison={comparison} />
            </div>

            {/* Learning insights — only after recording actual outcome */}
            {hasOutcomeData && (
              <div className="grid gap-4 md:grid-cols-2">
                <LearningInsight insight={learningInsight} />
                <ScoreAdjustment oldConfidence={confidenceBefore} newConfidence={confidenceAfter} />
              </div>
            )}
          </section>
        )}
      </div>

      <CaseBriefDialog
        open={briefDialog.open}
        loading={briefDialog.loading}
        data={briefDialog.data}
        error={briefDialog.error}
        onClose={() => setBriefDialog((prev) => ({ ...prev, open: false }))}
      />

      <FocusPanel
        data={focusPanelData}
        onClose={() => setFocusPanelData(null)}
        onGenerateBrief={() => {
          if (!focusPanelData) return;
          const sd = scoredSuggestions.find((s) => s.decisionId === focusPanelData.decisionId);
          if (sd) handleGenerateCaseBrief(sd);
          setFocusPanelData(null);
        }}
        onConvert={() => {
          if (!focusPanelData) return;
          const idx = scoredSuggestions.findIndex((s) => s.decisionId === focusPanelData.decisionId);
          if (idx !== -1) convertDecisionToPRD(scoredSuggestions[idx], idx);
          setFocusPanelData(null);
        }}
        onPushbackCta={(action) => { handlePushbackCta(action); setFocusPanelData(null); }}
        isBriefLoading={focusPanelData !== null && briefDialog.loading && briefDialog.decisionId === focusPanelData.decisionId}
        isConverting={focusPanelData !== null && isGeneratingPRDFor !== null && scoredSuggestions.some((s, i) => s.decisionId === focusPanelData.decisionId && isGeneratingPRDFor === `${s.title}-${i}`)}
      />
    </div>
  );
}

// ── DecisionGrid ──────────────────────────────────────────────────────────────

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
  onFocusDecision: (data: FocusPanelData) => void;
  onDeleteDecision: (decisionId: string) => void;
  onEditDecision: (decision: ScoredDecision) => void;
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
  onFocusDecision,
  onDeleteDecision,
  onEditDecision,
}: DecisionGridProps) {
  const annotated = React.useMemo(
    () => scoredSuggestions.map((decision, index) => ({
      decision, index,
      health: evaluateDecisionHealth(decision),
      pushbacks: evaluatePushback(decision),
    })),
    [scoredSuggestions]
  );

  const search = searchTerm.trim().toLowerCase();

  const filtered = React.useMemo(() => {
    return annotated.filter(({ decision, health }) => {
      if (filter === "strong" && health.status !== "healthy") return false;
      if (filter === "risky" && health.status === "healthy") return false;
      if (search) {
        const haystack = `${decision.title} ${decision.justification} ${decision.tradeoffs}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [annotated, filter, search]);

  // "recent" = newest first (array is already sorted by score; for recent we
  // want insertion order reversed, so we just reverse the filtered list).
  const displayItems = filter === "recent" ? [...filtered].reverse() : filtered;

  const grouped = React.useMemo(() => {
    const map: Record<HealthStatus, typeof displayItems> = { healthy: [], risky: [], weak: [] };
    // "recent" skips health grouping — show flat
    if (filter === "recent") return null;
    for (const item of displayItems) map[item.health.status].push(item);
    return map;
  }, [displayItems, filter]);

  const renderFeedbackFooter = (decision: ScoredDecision): React.ReactNode => {
    if (decision.score <= 0) return null;
    const fb = getFeedbackState(decision.decisionId);
    const canSubmit = fb.expected.trim().length > 0 && fb.actual.trim().length > 0 && !fb.submitting;

    if (!fb.shipped && !fb.submitted) {
      return (
        <div className="px-5 pb-4 pt-3 border-t border-border/60">
          <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground/60 hover:text-foreground"
            onClick={() => updateFeedbackState(decision.decisionId, { shipped: true })}>
            Mark as shipped
          </Button>
        </div>
      );
    }

    if (fb.submitted) {
      return (
        <div className="px-5 pb-4 pt-3 border-t border-border/60 space-y-2">
          <span className="block text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Outcome feedback</span>
          {fb.insight && <p className="text-xs text-foreground leading-relaxed bg-muted/40 p-2.5 rounded-md whitespace-pre-wrap">{fb.insight}</p>}
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
        <Input value={fb.expected} onChange={(e) => updateFeedbackState(decision.decisionId, { expected: e.target.value })} placeholder="Expected: 20% retention lift" disabled={fb.submitting} />
        <Input value={fb.actual}   onChange={(e) => updateFeedbackState(decision.decisionId, { actual:   e.target.value })} placeholder="Actual: 8% lift"              disabled={fb.submitting} />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onSubmitFeedback(decision, true)}  disabled={!canSubmit}>
            {fb.submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null} Shipped &amp; worked
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onSubmitFeedback(decision, false)} disabled={!canSubmit}>
            {fb.submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null} Didn&apos;t pan out
          </Button>
        </div>
      </div>
    );
  };

  const renderCard = ({ decision, index, health, pushbacks }: typeof displayItems[0]) => {
    const isBriefLoading = briefDialog.open && briefDialog.loading && briefDialog.decisionId === decision.decisionId;
    const isConverting = isGeneratingPRDFor === `${decision.title}-${index}`;
    return (
      <DecisionCardV2
        key={decision.decisionId}
        title={decision.title}
        summary={decision.summary || decision.justification}
        score={decision.score}
        health={health}
        priority={decision.priority}
        metrics={{ impact: decision.scoreBreakdown.impact, effort: decision.scoreBreakdown.effort, confidence: decision.scoreBreakdown.confidence, demand: decision.scoreBreakdown.demand }}
        pushbacks={pushbacks}
        topRisk={decision.risks?.[0]}
        onPushbackCta={onPushbackCta}
        onDelete={() => onDeleteDecision(decision.decisionId)}
        onEdit={() => onEditDecision(decision)}
        onGenerateBrief={() => onGenerateBrief(decision)}
        onConvert={() => onConvertToPRD(decision, index)}
        onFocus={() => onFocusDecision({
          decisionId: decision.decisionId,
          title: decision.title,
          summary: decision.summary || decision.justification,
          justification: decision.justification,
          userStory: decision.userStory,
          tradeoffs: decision.tradeoffs,
          priority: decision.priority,
          score: decision.score,
          impact: decision.scoreBreakdown.impact,
          effort: decision.scoreBreakdown.effort,
          confidence: decision.scoreBreakdown.confidence,
          demand: decision.scoreBreakdown.demand,
          reasoning: decision.scoreBreakdown.reasoning,
          health, pushbacks,
          keyInsight: decision.keyInsight,
          recommendation: decision.recommendation,
        })}
        isBriefLoading={isBriefLoading}
        isConverting={isConverting}
        footer={renderFeedbackFooter(decision)}
      />
    );
  };

  return (
    <div className="space-y-8">
      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search decisions…" className="pl-9 h-9 text-xs" />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card p-1 shadow-sm">
          {filterChips.map((chip) => (
            <button key={chip.id} type="button" onClick={() => setFilter(chip.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === chip.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}>
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {displayItems.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-12 text-center">
          <p className="text-sm font-medium">No decisions match this filter</p>
          <p className="mt-1 text-xs text-muted-foreground">{annotated.length} total · try a different filter or clear your search.</p>
        </div>
      )}

      {/* "Recent" view — flat list, no health grouping */}
      {filter === "recent" && displayItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayItems.map(renderCard)}
        </div>
      )}

      {/* All / Strong / Risky — grouped by health status */}
      {filter !== "recent" && grouped && groupOrder.map(({ status, label, subtitle, accentCls, dotCls }) => {
        const items = grouped[status];
        if (!items || items.length === 0) return null;
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
              {items.map(renderCard)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
