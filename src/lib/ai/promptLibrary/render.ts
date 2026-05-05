// renderPrompt — the only way actions should ever produce a prompt string.
// Pure lookup + template invocation + version resolution + snapshot hash.
// No async, no I/O.

import { REGISTRY } from "./registry";
import { getVersionForUser } from "./versions";
import type { PromptId, PromptVarsMap, RenderedPrompt } from "./types";

export interface RenderOptions {
  // When provided, version overrides are resolved against this user. Falls
  // back to the pinned version when omitted or unmatched.
  userId?: string | null;
}

// cyrb53 — small, deterministic, sync 53-bit hash. SHA-1-equivalent fidelity
// is overkill for forensic prompt fingerprinting and would force an async
// boundary (Web Crypto). cyrb53 is collision-resistant enough for our scale
// (single-user prompt registry, low cardinality).
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function hashPromptSnapshot(text: string): string {
  return cyrb53(text).toString(16).padStart(14, "0").slice(0, 10);
}

export function renderPrompt<K extends PromptId>(
  id: K,
  vars: PromptVarsMap[K],
  opts: RenderOptions = {}
): RenderedPrompt {
  const entry = REGISTRY[id];
  if (!entry) {
    throw new Error(`renderPrompt: unknown prompt id "${id}"`);
  }
  // Cast to the narrow signature — TypeScript can't narrow the indexed
  // function type on its own, but the mapped REGISTRY guarantees soundness.
  const prompt = (entry.template as (v: PromptVarsMap[K]) => string)(vars);
  const version = getVersionForUser(opts.userId ?? null, id);
  return {
    prompt,
    promptId: id,
    version,
    hash: hashPromptSnapshot(prompt),
  };
}
