// Final verdict engine. Pure compute over the final decision set so the
// agent can land on a single PROCEED / VALIDATE_FIRST / DO_NOT_BUILD
// recommendation rather than dumping data and walking away.

import type { DecisionSuggestion } from "./actions";

export type VerdictLabel = "PROCEED" | "VALIDATE_FIRST" | "DO_NOT_BUILD";

export interface Verdict {
  label: VerdictLabel;
  reason: string;
  averageConfidence: number;
  highRiskCount: number;
}

const isValidConfidence = (c: number | undefined): c is number =>
  typeof c === "number" && Number.isFinite(c);

const HIGH_RISK_RULE = (decision: DecisionSuggestion): boolean => {
  // A decision is "high-risk" if it's high-priority and confidence is
  // explicitly below 5 (including 0 — a unanimous "no evidence" rating is
  // the most high-risk state, not the missing-data state). Or 3+ risks.
  if (decision.priority === "high" && isValidConfidence(decision.confidence) && decision.confidence < 5) {
    return true;
  }
  if ((decision.risks?.length ?? 0) >= 3) return true;
  return false;
};

export function computeVerdict(decisions: DecisionSuggestion[]): Verdict {
  if (decisions.length === 0) {
    return {
      label: "DO_NOT_BUILD",
      reason: "No decisions to evaluate.",
      averageConfidence: 0,
      highRiskCount: 0,
    };
  }

  // Keep ALL numeric confidence values, including 0. A unanimous-zero run
  // should average 0, not be reported as "5". Only filter out values that
  // are missing entirely.
  const confidenceValues = decisions
    .map((d) => d.confidence)
    .filter(isValidConfidence);

  const averageConfidence = confidenceValues.length > 0
    ? confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length
    : 5;

  const highRiskCount = decisions.filter(HIGH_RISK_RULE).length;
  const topDecision = pickTopDecision(decisions);

  if (averageConfidence < 4 || highRiskCount > 0) {
    const driver = highRiskCount > 0
      ? `${highRiskCount} ${highRiskCount === 1 ? "decision is" : "decisions are"} high-priority with thin evidence.`
      : `Confidence averages ${averageConfidence.toFixed(1)}/10 across the candidates.`;
    return {
      label: "DO_NOT_BUILD",
      reason: `Don't build yet. ${driver} ${topDecision ? `Validate "${topDecision.title}" before committing engineering time.` : ""}`.trim(),
      averageConfidence,
      highRiskCount,
    };
  }

  if (averageConfidence >= 7 && highRiskCount === 0) {
    return {
      label: "PROCEED",
      reason: `Strong evidence across the board (avg confidence ${averageConfidence.toFixed(1)}/10). ${topDecision ? `Start with "${topDecision.title}".` : "Pick the top-priority decision and ship."}`,
      averageConfidence,
      highRiskCount,
    };
  }

  return {
    label: "VALIDATE_FIRST",
    reason: `Promising but not validated (avg confidence ${averageConfidence.toFixed(1)}/10). ${topDecision ? `Run a small test on "${topDecision.title}" before scaling.` : "Pick one decision and run a focused test."}`,
    averageConfidence,
    highRiskCount,
  };
}

// Spec rule: priority == HIGH, sort by (impact desc, confidence asc) — pick the
// most consequential decision that is also least proven, since that's where
// product judgment matters most.
export function pickTopDecision(decisions: DecisionSuggestion[]): DecisionSuggestion | null {
  const high = decisions.filter((d) => d.priority === "high");
  const pool = high.length > 0 ? high : decisions;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => {
    if (b.impact !== a.impact) return b.impact - a.impact;
    // Push decisions with missing confidence to the END (treat as the
    // safest sort, not the middle), so we don't bias the top pick toward
    // entries that simply omitted a confidence value.
    const ac = isValidConfidence(a.confidence) ? a.confidence : Number.POSITIVE_INFINITY;
    const bc = isValidConfidence(b.confidence) ? b.confidence : Number.POSITIVE_INFINITY;
    return ac - bc;
  })[0];
}

// Surfaces all unique assumptions across the decision set, capped to N. Used
// by the "Hidden Assumptions" UI block.
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

// Gate that decides whether the agent should run a reflection pass. Returns a
// short instruction the agent can paste into the refinement prompt, or null
// if the first pass was strong enough.
export function reflectionInstructionFor(decisions: DecisionSuggestion[]): string | null {
  if (decisions.length === 0) return null;
  const confidenceValues = decisions
    .map((d) => d.confidence)
    .filter(isValidConfidence);
  const avgConfidence = confidenceValues.length > 0
    ? confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length
    : 10;
  const totalRisks = decisions.reduce((sum, d) => sum + (d.risks?.length ?? 0), 0);

  if (avgConfidence < 5) {
    return `Confidence averaged ${avgConfidence.toFixed(1)}/10 — the directions you proposed don't have enough evidence behind them. Either find safer directions grounded in the notes, or be explicit about the validation step required.`;
  }
  if (totalRisks >= 4) {
    return `You surfaced ${totalRisks} risks across the directions — too many failure modes to commit. Tighten scope or propose lower-risk alternatives.`;
  }
  return null;
}
