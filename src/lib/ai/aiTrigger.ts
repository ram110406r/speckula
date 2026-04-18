import { extractSmartContext, type SmartContextWindow } from "./aiContext";
import {
  generateInlineSuggestion,
  type InlineLearningProfile,
  type InlineSuggestionPayload,
} from "./actions";

interface TriggerParams {
  text: string;
  cursorPos: number;
  learning?: InlineLearningProfile;
  onSuggestion: (result: { suggestion: InlineSuggestionPayload; context: SmartContextWindow; contextHash: string } | null) => void;
  onStart?: () => void;
  onError?: (error: unknown) => void;
}

const INLINE_AI_DEBOUNCE_MS = 800;
const MIN_CONTEXT_LENGTH = 40;

let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
let requestId = 0;
let lastHash = "";

function stableHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function cancelAISuggestionTrigger() {
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
  }
  requestId++;
}

export function triggerAISuggestion({ text, cursorPos, learning, onSuggestion, onStart, onError }: TriggerParams) {
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  const context = extractSmartContext(text, cursorPos);
  if ((context.block || context.sentence).length < MIN_CONTEXT_LENGTH) {
    onSuggestion(null);
    return;
  }

  const currentHash = stableHash(context.contextKey);
  if (currentHash === lastHash) {
    return;
  }

  timeoutHandle = setTimeout(async () => {
    const activeRequest = ++requestId;
    onStart?.();

    try {
      const suggestion = await generateInlineSuggestion(context, learning);
      if (activeRequest !== requestId) return;
      lastHash = currentHash;
      onSuggestion({ suggestion, context, contextHash: currentHash });
    } catch (error) {
      if (activeRequest !== requestId) return;
      onError?.(error);
      onSuggestion(null);
    }
  }, INLINE_AI_DEBOUNCE_MS);
}
