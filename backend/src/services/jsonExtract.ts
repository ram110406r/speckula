/**
 * Tolerant JSON-array extractor — Groq sometimes wraps output in prose or fences.
 */
export function extractJsonArray(raw: string): unknown[] {
  const trimmed = raw.trim();

  const direct = (() => {
    try { return JSON.parse(trimmed); } catch { return null; }
  })();
  if (Array.isArray(direct)) return direct;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      const parsed = JSON.parse(fence[1].trim());
      if (Array.isArray(parsed)) return parsed;
    } catch { /* fall through */ }
  }

  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch { /* fall through */ }
  }

  return [];
}
