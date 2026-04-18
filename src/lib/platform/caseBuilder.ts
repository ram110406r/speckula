import type { ExpectedOutcome } from "@/lib/ai/expectedOutcome";

export interface PublicCaseDraftInput {
  title: string;
  problem: string;
  solution: string;
  score: number;
  expected: ExpectedOutcome;
  description?: string;
}

export interface PublicCaseDraft {
  title: string;
  problem: string;
  solution: string;
  score: number;
  expectedOutcome: ExpectedOutcome;
  description: string;
  createdAt: number;
}

export function buildPublicCase(data: PublicCaseDraftInput): PublicCaseDraft {
  return {
    title: data.title.trim(),
    problem: data.problem.trim(),
    solution: data.solution.trim(),
    score: Math.max(0, Math.min(100, Math.round(data.score))),
    expectedOutcome: data.expected,
    description: (data.description ?? "").trim(),
    createdAt: Date.now(),
  };
}
