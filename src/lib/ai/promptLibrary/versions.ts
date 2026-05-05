// Pinned prompt versions. Bump when a prompt's wording or output schema
// materially changes so logs/analytics can correlate behavior shifts to the
// prompt revision.

import type { PromptId } from "./types";

export const PINNED_VERSIONS: Record<PromptId, string> = {
  insight_extractor: "1.0",
  suggest_direction: "2.1",
  expected_outcome: "1.1",
  prd_generator: "1.0",
  task_generator: "1.0",
  learning_insight: "1.0",
};

// Lightweight per-user A/B layer. Static in-memory map; intentionally not
// backed by Firestore yet. Hot-swap to a config service later if needed.
//   userOverrides = { [userId]: { [promptId]: version } }
export const userOverrides: Record<string, Partial<Record<PromptId, string>>> = {};

export function setUserOverride(userId: string, promptId: PromptId, version: string): void {
  if (!userOverrides[userId]) userOverrides[userId] = {};
  userOverrides[userId][promptId] = version;
}

export function clearUserOverrides(userId: string): void {
  delete userOverrides[userId];
}

// Resolve the active version for a (user, prompt) pair. Falls back to the
// pinned default when no userId is provided or no override exists.
export function getVersionForUser(userId: string | null | undefined, promptId: PromptId): string {
  if (userId) {
    const v = userOverrides[userId]?.[promptId];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return PINNED_VERSIONS[promptId];
}
