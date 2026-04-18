export interface ActiveBlock {
  block: string;
  blockStart: number;
  blockEnd: number;
  cursorPosInBlock: number;
}

export interface SmartContextWindow {
  block: string;
  sentence: string;
  cursorPos: number;
  cursorPosInBlock: number;
  contextKey: string;
}

function normalizeForKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
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

export function extractSmartContext(text: string, cursorPos: number): SmartContextWindow {
  const activeBlock = getActiveBlock(text, cursorPos);
  const sentence = getActiveSentence(activeBlock.block, activeBlock.cursorPosInBlock);
  const contextKey = normalizeForKey(activeBlock.block || sentence);

  return {
    block: activeBlock.block,
    sentence,
    cursorPos,
    cursorPosInBlock: activeBlock.cursorPosInBlock,
    contextKey,
  };
}
