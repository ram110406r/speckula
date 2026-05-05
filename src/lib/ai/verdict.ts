// Multi-factor verdict engine (v2.0).
//
// Scoring formula:
//   composite = confidence×0.40 + cost_viability×0.30 + demand_signal×0.20 + strategic_fit×0.10
//
// Replaces the single confidence-gate from v1.x. Cost and demand are now
// first-class signals derived from the CostModel and demand fields that
// suggestDirectionAction embeds in every CandidateDirection.

import type { DecisionSuggestion } from "./actions";

export type VerdictLabel = "PROCEED" | "VALIDATE_FIRST" | "DO_NOT_BUILD";

export interface VerdictFactors {
  confidence: number;    // 0–10, weight 40%
  costViability: number; // 0–10, weight 30%
  demandSignal: number;  // 0–10, weight 20%
  strategicFit: number;  // 0–10, weight 10%
}

export interface Verdict {
  label: VerdictLabel;
  reason: string;
  compositeScore: number;
  averageConfidence: number;
  highRiskCount: number;
  factors: VerdictFactors;
}

const isValidConfidence = (c: number | undefined): c is number =>
  typeof c === "number" && Number.isFinite(c);

const HIGH_RISK_RULE = (decision: DecisionSuggestion): boolean => {
  if (
    decision.priority === "high" &&
    isValidConfidence(decision.confidence) &&
    decision.confidence < 5
  ) {
    return true;
  }
  if ((decision.risks?.length ?? 0) >= 3) return true;
  return false;
};

// LOW <$500/mo → 9, MEDIUM $500–$2k → 6, HIGH >$2k → 3, unknown → 5.
function deriveCostViability(decisions: DecisionSuggestion[]): number {
  const withCost = decisions.filter((d) => d.costModel?.category);
  if (withCost.length === 0) return 5;
  const scores = withCost.map((d): number => {
    const cat = d.costModel!.category;
    if (cat === "LOW") return 9;
    if (cat === "MEDIUM") return 6;
    return 3;
  });
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

function deriveDemandSignal(decisions: DecisionSuggestion[]): number {
  const withDemand = decisions.filter(
    (d) => typeof d.demand === "number" && Number.isFinite(d.demand)
  );
  if (withDemand.length === 0) return 5;
  return withDemand.reduce((sum, d) => sum + (d.demand ?? 0), 0) / withDemand.length;
}

export function computeVerdict(decisions: DecisionSuggestion[]): Verdict {
  if (decisions.length === 0) {
    const factors: VerdictFactors = { confidence: 0, costViability: 0, demandSignal: 0, strategicFit: 0 };
    return {
      label: "DO_NOT_BUILD",
      reason: "No decisions to evaluate.",
      compositeScore: 0,
      averageConfidence: 0,
      highRiskCount: 0,
      factors,
    };
  }

  const confidenceValues = decisions.map((d) => d.confidence).filter(isValidConfidence);
  const averageConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length
      : 5;

  const highRiskCount = decisions.filter(HIGH_RISK_RULE).length;
  const topDecision = pickTopDecision(decisions);

  const costViability = deriveCostViability(decisions);
  const demandSignal = deriveDemandSignal(decisions);
  // Strategic fit: proxy from available signals. Penalise if multiple blockers.
  const strategicFit = highRiskCount > 1 ? 5 : 7;

  const compositeScore =
    averageConfidence * 0.4 +
    costViability * 0.3 +
    demandSignal * 0.2 +
    strategicFit * 0.1;

  const r1 = (n: number) => Math.round(n * 10) / 10;

  const factors: VerdictFactors = {
    confidence: r1(averageConfidence),
    costViability: r1(costViability),
    demandSignal: r1(demandSignal),
    strategicFit: r1(strategicFit),
  };

  const rounded = r1(compositeScore);

  if (compositeScore < 4.0 || (highRiskCount > 0 && compositeScore < 5.5)) {
    const driver =
      highRiskCount > 0
        ? `${highRiskCount} ${highRiskCount === 1 ? "decision is" : "decisions are"} high-priority with thin evidence.`
        : `Composite score ${rounded}/10 — confidence, cost, and demand signals are too weak.`;
    return {
      label: "DO_NOT_BUILD",
      reason: `Don't build yet. ${driver} ${topDecision ? `Validate "${topDecision.title}" before committing engineering time.` : ""}`.trim(),
      compositeScore: rounded,
      averageConfidence,
      highRiskCount,
      factors,
    };
  }

  if (compositeScore >= 7.0 && highRiskCount === 0) {
    return {
      label: "PROCEED",
      reason: `Strong signal across confidence, cost, and demand (composite ${rounded}/10). ${topDecision ? `Start with "${topDecision.title}".` : "Pick the top-priority decision and ship."}`,
      compositeScore: rounded,
      averageConfidence,
      highRiskCount,
      factors,
    };
  }

  return {
    label: "VALIDATE_FIRST",
    reason: `Promising but not fully validated (composite ${rounded}/10). ${topDecision ? `Run a focused test on "${topDecision.title}" before scaling.` : "Pick one direction and run a validation experiment."}`,
    compositeScore: rounded,
    averageConfidence,
    highRiskCount,
    factors,
  };
}

// Spec rule: priority==HIGH, sort by (impact desc, confidence asc) — pick the most
// consequential direction that is also least proven.
export function pickTopDecision(decisions: DecisionSuggestion[]): DecisionSuggestion | null {
  const high = decisions.filter((d) => d.priority === "high");
  const pool = high.length > 0 ? high : decisions;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => {
    if (b.impact !== a.impact) return b.impact - a.impact;
    const ac = isValidConfidence(a.confidence) ? a.confidence : Number.POSITIVE_INFINITY;
    const bc = isValidConfidence(b.confidence) ? b.confidence : Number.POSITIVE_INFINITY;
    return ac - bc;
  })[0];
}

// Surfaces unique assumptions across the decision set for the UI block.
export function collectAssumptions(decisions: DecisionSuggestion[], max = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const decision of decisions) {
    for (const assumption of decision.assumptions ?? []) {
      const key = assumption.toLowerCase().replace(/\s+/g, " ").trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(assumption.trim());
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}

// Gate that decides whether the agent should run a reflection pass.
// v2.0: also triggers on HIGH-cost directions with multiple risks.
export function reflectionInstructionFor(decisions: DecisionSuggestion[]): string | null {
  if (decisions.length === 0) return null;

  const confidenceValues = decisions.map((d) => d.confidence).filter(isValidConfidence);
  const avgConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length
      : 10;
  const totalRisks = decisions.reduce((sum, d) => sum + (d.risks?.length ?? 0), 0);
  const hasHighCostWithRisks = decisions.some(
    (d) => d.costModel?.category === "HIGH" && (d.risks?.length ?? 0) >= 2
  );

  if (avgConfidence < 5) {
    return `Confidence averaged ${avgConfidence.toFixed(1)}/10 — the directions you proposed don't have enough evidence behind them. Either find safer directions grounded in the notes, or be explicit about the validation step required.`;
  }
  if (totalRisks >= 4) {
    return `You surfaced ${totalRisks} risks across the directions — too many failure modes to commit. Tighten scope or propose lower-risk alternatives.`;
  }
  if (hasHighCostWithRisks) {
    return `A HIGH-cost direction has multiple risks — hidden costs could kill this before launch. Re-evaluate whether a MEDIUM-cost approach achieves the same outcome.`;
  }
  return null;
}
