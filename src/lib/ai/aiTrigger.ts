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
  // Session key — scopes all internal state (debounce timer, last-hash,
  // request id) to this caller. Use the document id (or any unique
  // string) so two editor instances / Strict-Mode double-mounts /
  // doc switches don't share singletons.
  sessionKey?: string;
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

interface TriggerSessionState {
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  requestId: number;
  lastHash: string;
  lastEditAt: number;
  lastTextSnapshot: string;
}

const DEFAULT_KEY = "__default__";
const sessions = new Map<string, TriggerSessionState>();

const getSession = (key: string): TriggerSessionState => {
  let s = sessions.get(key);
  if (!s) {
    s = { timeoutHandle: null, requestId: 0, lastHash: "", lastEditAt: 0, lastTextSnapshot: "" };
    sessions.set(key, s);
  }
  return s;
};

function stableHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function cancelAISuggestionTrigger(sessionKey?: string) {
  // Cancel either a specific session, or all sessions (used on full unmount).
  if (sessionKey) {
    const s = sessions.get(sessionKey);
    if (s) {
      if (s.timeoutHandle) clearTimeout(s.timeoutHandle);
      s.timeoutHandle = null;
      s.requestId += 1;
    }
    return;
  }
  for (const s of sessions.values()) {
    if (s.timeoutHandle) clearTimeout(s.timeoutHandle);
    s.timeoutHandle = null;
    s.requestId += 1;
  }
}

function isEndOfThought(text: string, pauseTime: number) {
  return text.endsWith(".") || text.endsWith("?") || text.endsWith("!") || text.endsWith("\n") || pauseTime > THINKING_PAUSE_MS;
}

export function triggerAISuggestion({ sessionKey, text, cursorPos, onSuggestion, onStart, onError }: TriggerParams) {
  const key = sessionKey || DEFAULT_KEY;
  const session = getSession(key);
  session.lastEditAt = Date.now();
  session.lastTextSnapshot = text;

  if (session.timeoutHandle) {
    clearTimeout(session.timeoutHandle);
  }

  const context = extractHierarchicalContext(text, cursorPos);
  if ((context.block || context.sentence).length < MIN_CONTEXT_LENGTH) {
    onSuggestion(null);
    return;
  }

  const currentHash = stableHash(context.contextKey);

  const run = async () => {
    const pauseTime = Date.now() - session.lastEditAt;
    if (!isEndOfThought(session.lastTextSnapshot, pauseTime)) {
      const remainingDelay = Math.max(0, THINKING_PAUSE_MS - pauseTime);
      session.timeoutHandle = setTimeout(run, remainingDelay || INLINE_AI_DEBOUNCE_MS);
      return;
    }

    if (currentHash === session.lastHash) {
      return;
    }

    const activeRequest = ++session.requestId;
    onStart?.();

    try {
      const entities = extractEntities(context.sentence || context.block || text);
      const gaps = detectGaps(entities);
      const progress = updateProgress(context.block || context.sentence || text);
      const suggestion = await generateNextStepsWithSignals(context.block || context.sentence || text, entities, gaps, progress);
      if (activeRequest !== session.requestId) return;
      if (!shouldShowNextSteps(suggestion)) {
        onSuggestion(null);
        return;
      }

      session.lastHash = currentHash;
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
      if (activeRequest !== session.requestId) return;
      onError?.(error);
      onSuggestion(null);
    }
  };

  session.timeoutHandle = setTimeout(run, INLINE_AI_DEBOUNCE_MS);
}
