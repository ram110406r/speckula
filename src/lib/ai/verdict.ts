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

const HIGH_RISK_RULE = (decision: DecisionSuggestion): boolean => {
  // A decision is "high-risk" if it's high-priority but evidence is thin, OR
  // it carries 3+ surfaced risks. Mirrors the bar a senior PM would apply.
  const confidence = decision.confidence ?? 0;
  if (decision.priority === "high" && confidence > 0 && confidence < 5) return true;
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

  const confidenceValues = decisions
    .map((d) => d.confidence)
    .filter((c): c is number => typeof c === "number" && c > 0);

  // Fall back to averaging impact when confidence wasn't returned by the model
  // — better than treating absent confidence as zero, which would always force
  // DO_NOT_BUILD on legacy data.
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
    return (a.confidence ?? 5) - (b.confidence ?? 5);
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
    .filter((c): c is number => typeof c === "number" && c > 0);
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
