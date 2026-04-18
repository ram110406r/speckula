import type { ExpectedOutcome } from "@/lib/ai/expectedOutcome";
import { getPublicCasesByUser, getPublicProfile, savePublicCase, savePublicProfile } from "@/lib/firebase/db";
import type { PublicCaseDraft } from "./caseBuilder";

export interface PublishCaseInput {
  userId: string;
  draft: PublicCaseDraft;
  visibility: "public" | "private";
}

function toCaseContent(draft: PublicCaseDraft) {
  const segments = [
    `Problem\n${draft.problem}`,
    `Solution\n${draft.solution}`,
    draft.description ? `Notes\n${draft.description}` : null,
    `Expected Outcome\n${draft.expectedOutcome.metric}: ${draft.expectedOutcome.target_value} in ${draft.expectedOutcome.timeframe}`,
  ].filter(Boolean);

  return segments.join("\n\n");
}

function averageScore(scores: number[]) {
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export async function publishCase({ userId, draft, visibility }: PublishCaseInput) {
  const caseId = await savePublicCase({
    userId,
    title: draft.title,
    content: toCaseContent(draft),
    score: draft.score,
    outcome: {
      expectedOutcome: draft.expectedOutcome,
      publishedAt: draft.createdAt,
    },
    visibility,
  });

  const [profile, latestCases] = await Promise.all([
    getPublicProfile(userId),
    getPublicCasesByUser(userId, true),
  ]);

  const publicCases = latestCases.filter((entry) => entry.visibility === "public");
  const publicCaseIds = publicCases.map((entry) => entry.id);
  const publicScores = publicCases.map((entry) => entry.score);

  await savePublicProfile(userId, {
    userId,
    name: profile?.name ?? "",
    bio: profile?.bio ?? "",
    skills: profile?.skills ?? [],
    publicCases: publicCaseIds,
    scoreAverage: averageScore(publicScores),
  });

  return caseId;
}

export function validatePublishReadiness(expectedOutcome: ExpectedOutcome | null | undefined) {
  return Boolean(expectedOutcome && expectedOutcome.metric && expectedOutcome.timeframe);
}
