"use client";

import React from "react";
import { Compass, Sparkles, Loader2, Target, Zap, Users, Brain } from "lucide-react";
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
  type DecisionSuggestion,
  type StrategicGuidance,
} from "@/lib/ai/actions";
import { generateLearningInsight } from "@/lib/ai/learningEngine";
import { calculateScore, type OpportunityScoreData } from "@/lib/ai/scoreEngine";
import { updateScore } from "@/lib/ai/scoreEvolution";
import { getScoreHistory, recordScoreHistory, type OpportunityScoreHistoryEntry } from "@/lib/ai/scoreHistory";
import { ScoreCard } from "@/components/decision/ScoreCard";
import { BreakdownChart } from "@/components/decision/BreakdownChart";
import { ScoreHistoryGraph } from "@/components/decision/ScoreHistoryGraph";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OutcomeCard } from "@/components/outcome/OutcomeCard";
import { LearningInsight } from "@/components/outcome/LearningInsight";
import { ScoreAdjustment } from "@/components/outcome/ScoreAdjustment";
import { compareOutcomes, type OutcomeComparison } from "@/lib/ai/comparisonEngine";
import { getExpectedOutcome, setExpectedOutcome, type ExpectedOutcomeRecord } from "@/lib/ai/expectedOutcome";
import { getActualOutcome, recordActualOutcome, type ActualOutcomeRecord } from "@/lib/ai/actualOutcome";
import { updateConfidenceScore } from "@/lib/ai/scoreFeedback";
import { buildPublicCase } from "@/lib/platform/caseBuilder";
import { publishCase, validatePublishReadiness } from "@/lib/platform/publishCase";

const priorityColors = {
  high: "text-primary border-primary/20 bg-primary/5",
  medium: "text-muted-foreground border-border bg-muted/5",
  low: "text-muted-foreground/60 border-border/40 bg-transparent",
};

interface ScoredDecision extends DecisionSuggestion {
  scoreBreakdown: OpportunityScoreData;
  score: number;
}

interface PublishModalState {
  decision: ScoredDecision;
  index: number;
  title: string;
  description: string;
  visibility: "public" | "private";
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
  const [publishModal, setPublishModal] = React.useState<PublishModalState | null>(null);
  const [publishingKey, setPublishingKey] = React.useState<string | null>(null);
  const [publishFeedback, setPublishFeedback] = React.useState<{ status: "success" | "error"; message: string } | null>(null);

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

  const handleOpenPublishModal = (decision: ScoredDecision, index: number) => {
    if (!expectedOutcome) return;

    setPublishFeedback(null);
    setPublishModal({
      decision,
      index,
      title: decision.title,
      description: decision.justification,
      visibility: "public",
    });
  };

  const handlePublishDecision = async () => {
    if (!user || !publishModal || !expectedOutcome) return;

    const key = `${publishModal.decision.title}-${publishModal.index}`;
    setPublishingKey(key);
    setPublishFeedback(null);

    try {
      const problem = strategicGuidance?.theme || publishModal.decision.justification;
      const solution = publishModal.decision.userStory;
      const draft = buildPublicCase({
        title: publishModal.title,
        problem,
        solution,
        score: publishModal.decision.score,
        expected: expectedOutcome.expected,
        description: publishModal.description,
      });

      await publishCase({
        userId: user.uid,
        draft,
        visibility: publishModal.visibility,
      });

      setPublishFeedback({ status: "success", message: "Published successfully. This case now appears on your public profile." });
      setPublishModal(null);
    } catch (error) {
      console.error("Failed to publish case:", error);
      setPublishFeedback({ status: "error", message: "Publishing failed. Please retry." });
    } finally {
      setPublishingKey(null);
    }
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
            scoreBreakdown: breakdown,
            score: scoreValue,
          } satisfies ScoredDecision;
        })
      );

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
        expected.expected,
        actual.actual
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
      <div className="flex items-center justify-between px-8 h-14 border-b border-border/60 shrink-0 bg-white/50">
        <div className="flex items-center gap-2.5">
          <Compass className="h-4 w-4 text-primary" />
          <span className="label-system text-[12px]">Decision Engine</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 label-system text-[12px] hover:text-primary hover:bg-transparent"
          onClick={handleGenerate}
          disabled={isLoading || !currentDocId}
        >
          {isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          {isLoading ? "Synthesizing Direction..." : "Ask: What to build next?"}
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

      <Dialog open={Boolean(publishModal)} onOpenChange={(open) => {
        if (!open) {
          setPublishModal(null);
          setPublishFeedback(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Publish Case</DialogTitle>
            <DialogDescription>
              Convert this decision into a shareable product case. You can edit the title, notes, and visibility before publishing.
            </DialogDescription>
          </DialogHeader>

          {publishModal && (
            <div className="flex-1 overflow-auto space-y-4 py-1">
              <div>
                <p className="label-system text-[10px] uppercase tracking-widest text-muted-foreground">Title</p>
                <Input
                  className="mt-2"
                  value={publishModal.title}
                  onChange={(event) => setPublishModal((current) => current ? { ...current, title: event.target.value } : current)}
                  placeholder="Case title"
                />
              </div>

              <div>
                <p className="label-system text-[10px] uppercase tracking-widest text-muted-foreground">Description</p>
                <Textarea
                  className="mt-2 min-h-[120px]"
                  value={publishModal.description}
                  onChange={(event) => setPublishModal((current) => current ? { ...current, description: event.target.value } : current)}
                  placeholder="Short public summary"
                />
              </div>

              <div>
                <p className="label-system text-[10px] uppercase tracking-widest text-muted-foreground">Visibility</p>
                <select
                  className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={publishModal.visibility}
                  onChange={(event) => setPublishModal((current) => current ? { ...current, visibility: event.target.value as "public" | "private" } : current)}
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-1">
                <p><span className="label-system text-[10px] uppercase text-muted-foreground">Problem:</span> {strategicGuidance?.theme || publishModal.decision.justification}</p>
                <p><span className="label-system text-[10px] uppercase text-muted-foreground">Solution:</span> {publishModal.decision.userStory}</p>
                <p><span className="label-system text-[10px] uppercase text-muted-foreground">Score:</span> {publishModal.decision.score}</p>
                {expectedOutcome && (
                  <p>
                    <span className="label-system text-[10px] uppercase text-muted-foreground">Expected Outcome:</span>{" "}
                    {expectedOutcome.expected.metric} {expectedOutcome.expected.target_value} in {expectedOutcome.expected.timeframe}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setPublishModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={handlePublishDecision}
              disabled={!publishModal?.title.trim() || !publishModal?.description.trim() || publishingKey === (publishModal ? `${publishModal.decision.title}-${publishModal.index}` : null)}
            >
              {publishingKey === (publishModal ? `${publishModal.decision.title}-${publishModal.index}` : null) ? "Publishing..." : "Publish Case"}
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

        {publishFeedback && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${publishFeedback.status === "success" ? "border-primary/20 bg-primary/5 text-primary" : "border-red-200 bg-red-50 text-red-700"}`}>
            {publishFeedback.message}
          </div>
        )}

        {strategicGuidance && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <p className="label-system text-[10px] uppercase tracking-widest text-primary mb-2">Strategic Focus</p>
            <h2 className="text-sm font-semibold text-foreground mb-2">{strategicGuidance.theme}</h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">{strategicGuidance.rationale}</p>
            {strategicGuidance.gaps.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {strategicGuidance.gaps.map((gap) => (
                  <span key={gap} className="label-system text-[10px] rounded-full border border-primary/20 bg-white px-2 py-1">
                    {gap}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {suggestions.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 text-center border-2 border-dashed border-border/40 rounded-2xl max-w-2xl mx-auto">
            <Target className="h-10 w-10 text-muted-foreground/20 mb-6" />
            <p className="label-system text-[12px] mb-2 uppercase tracking-widest">Strategic Void</p>
            <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto leading-relaxed mb-8">
              No product direction has been synthesized yet. Launch the Decision Engine to transform your research into a prioritized feature roadmap.
            </p>
            <Button 
              className="bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/10 rounded-lg px-8 label-system text-[12px]"
              onClick={handleGenerate}
              disabled={!currentDocId}
            >
              <Zap className="mr-2 h-3.5 w-3.5" />
              Analyze Product Context
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Brain className="h-8 w-8 animate-pulse text-primary/40" />
            <span className="label-system text-[12px] animate-pulse">Running Competitive & Contextual Analysis</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {scoredSuggestions.map((s, i) => (
              <div key={i} className="flex flex-col bg-white border border-border shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-all hover:border-primary/20 group">
                <div className="p-5 flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`label-system text-[10px] px-2 py-0.5 rounded-sm border ${priorityColors[s.priority]}`}>
                      {s.priority} priority
                    </span>
                    <span className="label-system text-[10px] rounded-sm border border-primary/20 bg-primary/5 px-2 py-0.5 text-primary">
                      Score {s.score}
                    </span>
                    <div className="flex items-center gap-2">
                       <Users className="h-3 w-3 text-muted-foreground/40" />
                       <span className="label-system text-[10px] text-muted-foreground/60">Target Alpha</span>
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold mb-3 group-hover:text-primary transition-colors leading-tight">
                    {s.title}
                  </h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed mb-4 italic border-l-2 border-primary/10 pl-3">
                    {s.justification}
                  </p>
                  <p className="text-[12px] text-muted-foreground leading-relaxed mb-4">
                    <span className="label-system text-[10px] block mb-1 opacity-60">Trade-offs</span>
                    {s.tradeoffs}
                  </p>
                  <p className="text-[12px] text-foreground font-medium leading-relaxed bg-muted/20 p-2.5 rounded-lg border border-border/40">
                    <span className="label-system text-[10px] block mb-1 opacity-60">User Story</span>
                    {s.userStory}
                  </p>
                </div>
                <div className="px-5 py-4 bg-muted/10 border-t border-border/40 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="label-system text-[9px] uppercase opacity-60">Estimated Impact</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 w-16 bg-border/40 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${s.impact * 10}%` }} />
                      </div>
                      <span className="label-system text-[11px] font-bold">{s.impact}/10</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <span className="label-system text-[9px] uppercase opacity-60">Dev Effort</span>
                    <div className="flex items-center gap-1.5">
                      <span className="label-system text-[11px] font-bold">{s.effort}/10</span>
                      <div className="flex-1 h-1.5 w-16 bg-border/40 rounded-full overflow-hidden">
                        <div className="h-full bg-muted-foreground/40" style={{ width: `${s.effort * 10}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <div className="space-y-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full label-system text-[11px]"
                      onClick={() => convertDecisionToPRD(s, i)}
                      disabled={isGeneratingPRDFor === `${s.title}-${i}`}
                    >
                      {isGeneratingPRDFor === `${s.title}-${i}` ? "Generating PRD..." : "Convert to PRD"}
                    </Button>

                    {validatePublishReadiness(expectedOutcome?.expected) ? (
                      <>
                        <p className="text-[11px] text-muted-foreground text-center">Ready to share this thinking as a public case.</p>
                        <Button
                          size="sm"
                          className="w-full label-system text-[11px]"
                          onClick={() => handleOpenPublishModal(s, i)}
                          disabled={publishingKey === `${s.title}-${i}`}
                        >
                          {publishingKey === `${s.title}-${i}` ? "Publishing..." : "Publish Case"}
                        </Button>
                      </>
                    ) : (
                      <p className="text-[11px] text-muted-foreground text-center">Save Expected Outcome to unlock publishing.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
