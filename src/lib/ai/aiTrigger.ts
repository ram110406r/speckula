import { extractHierarchicalContext, type HierarchicalContext } from "./aiContext";
import {
  generateNextStepsWithSignals,
  type InlineLearningProfile,
  type InlineSuggestionPayload,
} from "./actions";
import { shouldShowNextSteps } from "./aiFilter";
import { updateProgress } from "./progressTracker";
import { prioritizeSteps } from "./priorityEngine";
import { extractEntities, detectGaps } from "./aiContext";

interface TriggerParams {
  text: string;
  cursorPos: number;
  learning?: InlineLearningProfile;
  onSuggestion: (result: { suggestion: InlineSuggestionPayload; context: HierarchicalContext; contextHash: string } | null) => void;
  onStart?: () => void;
  onError?: (error: unknown) => void;
}

const INLINE_AI_DEBOUNCE_MS = 800;
const THINKING_PAUSE_MS = 1200;
const MIN_CONTEXT_LENGTH = 40;

let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
let requestId = 0;
let lastHash = "";
let lastEditAt = 0;
let lastTextSnapshot = "";

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

function isEndOfThought(text: string, pauseTime: number) {
  return text.endsWith(".") || text.endsWith("?") || text.endsWith("!") || text.endsWith("\n") || pauseTime > THINKING_PAUSE_MS;
}

export function triggerAISuggestion({ text, cursorPos, onSuggestion, onStart, onError }: TriggerParams) {
  lastEditAt = Date.now();
  lastTextSnapshot = text;

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  const context = extractHierarchicalContext(text, cursorPos);
  if ((context.block || context.sentence).length < MIN_CONTEXT_LENGTH) {
    onSuggestion(null);
    return;
  }

  const currentHash = stableHash(context.contextKey);

  const run = async () => {
    const pauseTime = Date.now() - lastEditAt;
    if (!isEndOfThought(lastTextSnapshot, pauseTime)) {
      const remainingDelay = Math.max(0, THINKING_PAUSE_MS - pauseTime);
      timeoutHandle = setTimeout(run, remainingDelay || INLINE_AI_DEBOUNCE_MS);
      return;
    }

    if (currentHash === lastHash) {
      return;
    }

    const activeRequest = ++requestId;
    onStart?.();

    try {
      const entities = extractEntities(context.sentence || context.block || text);
      const gaps = detectGaps(entities);
      const progress = updateProgress(context.block || context.sentence || text);
      const suggestion = await generateNextStepsWithSignals(context.block || context.sentence || text, entities, gaps, progress);
      if (activeRequest !== requestId) return;
      if (!shouldShowNextSteps(suggestion)) {
        onSuggestion(null);
        return;
      }

      lastHash = currentHash;
      const prioritized = prioritizeSteps(suggestion.next_steps);
      onSuggestion({
        suggestion: {
          stage: suggestion.stage,
          next_steps: [...prioritized.high_priority, ...prioritized.medium].filter(Boolean),
        },
        context,
        contextHash: currentHash,
      });
    } catch (error) {
      if (activeRequest !== requestId) return;
      onError?.(error);
      onSuggestion(null);
    }
  };

  timeoutHandle = setTimeout(run, INLINE_AI_DEBOUNCE_MS);
}
