import { extractContext } from "./aiContext";
import { generateInlineSuggestion, type InlineSuggestionPayload } from "./actions";

interface TriggerParams {
  text: string;
  cursorPos: number;
  onSuggestion: (suggestion: InlineSuggestionPayload | null) => void;
  onStart?: () => void;
  onError?: (error: unknown) => void;
}

const INLINE_AI_DEBOUNCE_MS = 800;
const MIN_CONTEXT_LENGTH = 80;

let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
let requestId = 0;

export function cancelAISuggestionTrigger() {
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
  }
  requestId++;
}

export function triggerAISuggestion({ text, cursorPos, onSuggestion, onStart, onError }: TriggerParams) {
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  const { context } = extractContext(text, cursorPos);
  if (context.length < MIN_CONTEXT_LENGTH) {
    onSuggestion(null);
    return;
  }

  timeoutHandle = setTimeout(async () => {
    const activeRequest = ++requestId;
    onStart?.();

    try {
      const suggestion = await generateInlineSuggestion(context);
      if (activeRequest !== requestId) return;
      onSuggestion(suggestion);
    } catch (error) {
      if (activeRequest !== requestId) return;
      onError?.(error);
      onSuggestion(null);
    }
  }, INLINE_AI_DEBOUNCE_MS);
}
