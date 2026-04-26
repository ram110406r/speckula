import type { OpportunityScoreData } from "./scoreEngine";

export type HealthStatus = "healthy" | "risky" | "weak";

export interface DecisionHealth {
  status: HealthStatus;
  reason: string;
}

interface HealthInput {
  priority: "high" | "medium" | "low";
  scoreBreakdown: OpportunityScoreData;
  score: number;
}

// Single line of judgment per decision. Rules are ordered: weak (deal-breakers)
// short-circuits over risky (concerns), which short-circuits over healthy.
export function evaluateDecisionHealth(d: HealthInput): DecisionHealth {
  const { confidence, impact, effort, demand } = d.scoreBreakdown;

  if (confidence <= 2) {
    return { status: "weak", reason: "No supporting evidence" };
  }
  if (confidence < 5 && d.priority === "high") {
    return { status: "weak", reason: "Low confidence for high priority" };
  }
  if (effort >= 8 && impact <= 4) {
    return { status: "weak", reason: "High effort, low impact" };
  }

  if (confidence < 5) {
    return { status: "risky", reason: "Evidence is thin" };
  }
  if (effort >= 7 && impact < 6) {
    return { status: "risky", reason: "Effort outweighs likely impact" };
  }
  if (demand <= 3) {
    return { status: "risky", reason: "Weak demand signal" };
  }

  return { status: "healthy", reason: "Well-supported and balanced" };
}

export type PushbackSeverity = "warn" | "alert";
export type PushbackAction = "add-evidence" | "rescore";

export interface Pushback {
  id: string;
  severity: PushbackSeverity;
  message: string;
  cta: { label: string; action: PushbackAction };
}

// Deterministic challenges driven by the four scored dimensions. Each warning
// pairs with a CTA that jumps the user toward the missing input or a re-score,
// so warnings create friction instead of being dismissable noise.
export function evaluatePushback(d: HealthInput): Pushback[] {
  const out: Pushback[] = [];
  const { confidence, impact, effort } = d.scoreBreakdown;

  if (confidence < 5 && d.priority === "high") {
    out.push({
      id: "low-confidence-high-priority",
      severity: "alert",
      message:
        "Low confidence on a high-priority decision. You're likely overcommitting — validate before executing.",
      cta: { label: "Add evidence", action: "add-evidence" },
    });
  }

  if (confidence <= 2) {
    out.push({
      id: "no-evidence",
      severity: "alert",
      message: "This decision is built on assumptions, not evidence.",
      cta: { label: "Add evidence", action: "add-evidence" },
    });
  }

  if (effort > 7 && impact < 5) {
    out.push({
      id: "high-effort-low-impact",
      severity: "warn",
      message: "High effort for low impact. Consider deprioritizing or reframing the scope.",
      cta: { label: "Re-score", action: "rescore" },
    });
  }

  return out;
}
