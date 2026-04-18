export interface InlineContextWindow {
  context: string;
  before: string;
  after: string;
  cursorPos: number;
}

const DEFAULT_WINDOW_SIZE = 220;

export function extractContext(text: string, cursorPos: number, windowSize = DEFAULT_WINDOW_SIZE): InlineContextWindow {
  const safeCursor = Math.max(0, Math.min(cursorPos, text.length));
  const before = text.slice(Math.max(0, safeCursor - windowSize), safeCursor);
  const after = text.slice(safeCursor, Math.min(text.length, safeCursor + windowSize));

  return {
    context: `${before}${after}`.trim(),
    before,
    after,
    cursorPos: safeCursor,
  };
}
