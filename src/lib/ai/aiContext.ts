export type InlineIntent = "retention" | "onboarding" | "metrics" | "general";

export interface ActiveBlock {
  block: string;
  blockStart: number;
  blockEnd: number;
  cursorPosInBlock: number;
}

export interface HierarchicalContext {
  sentence: string;
  block: string;
  section: string;
  documentIntent: InlineIntent;
  cursorPos: number;
  cursorPosInBlock: number;
  contextKey: string;
}

function normalizeForKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function detectIntent(text: string): InlineIntent {
  if (text.match(/drop|retention|churn/i)) return "retention";
  if (text.match(/signup|onboarding/i)) return "onboarding";
  if (text.match(/metric|conversion|rate/i)) return "metrics";
  return "general";
}

function isHeadingLike(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("#")) return true;
  if (/[.!?]$/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 10) return false;
  return words.every((word) => /^[A-Z][\w-]*$/.test(word) || /^[A-Z0-9][A-Z0-9\-]*$/.test(word));
}

export function getActiveBlock(text: string, cursorPos: number): ActiveBlock {
  const safeCursor = Math.max(0, Math.min(cursorPos, text.length));
  const blocks = text.split("\n");

  let currentPos = 0;
  for (const block of blocks) {
    const start = currentPos;
    const end = currentPos + block.length;

    if (safeCursor >= start && safeCursor <= end) {
      const trimmedBlock = block.trim();
      return {
        block: trimmedBlock,
        blockStart: start,
        blockEnd: end,
        cursorPosInBlock: Math.max(0, Math.min(safeCursor - start, block.length)),
      };
    }

    currentPos = end + 1;
  }

  return {
    block: "",
    blockStart: 0,
    blockEnd: 0,
    cursorPosInBlock: 0,
  };
}

export function getActiveSentence(block: string, cursorPosInBlock: number): string {
  if (!block.trim()) return "";

  const sentenceRegex = /[^.!?]+[.!?]?/g;
  let match: RegExpExecArray | null;

  while ((match = sentenceRegex.exec(block)) !== null) {
    const sentence = match[0];
    const start = match.index;
    const end = start + sentence.length;

    if (cursorPosInBlock >= start && cursorPosInBlock <= end) {
      return sentence.trim();
    }
  }

  return block.trim();
}

export function getActiveSection(text: string, cursorPos: number): string {
  const safeCursor = Math.max(0, Math.min(cursorPos, text.length));
  const precedingLines = text.slice(0, safeCursor).split("\n");

  for (let i = precedingLines.length - 1; i >= 0; i--) {
    const line = precedingLines[i]?.trim() ?? "";
    if (isHeadingLike(line)) {
      return line.replace(/^#+\s*/, "").trim();
    }
  }

  return "";
}

export function extractHierarchicalContext(text: string, cursorPos: number): HierarchicalContext {
  const activeBlock = getActiveBlock(text, cursorPos);
  const sentence = getActiveSentence(activeBlock.block, activeBlock.cursorPosInBlock);
  const section = getActiveSection(text, cursorPos);
  const documentIntent = detectIntent(text);
  const contextKey = normalizeForKey([section, activeBlock.block || sentence, documentIntent].filter(Boolean).join(" | "));

  return {
    sentence,
    block: activeBlock.block,
    section,
    documentIntent,
    cursorPos,
    cursorPosInBlock: activeBlock.cursorPosInBlock,
    contextKey,
  };
}
