import type { InlineSuggestionPayload } from "./actions";

export function isGeneric(suggestions: string[]) {
  return suggestions.some((suggestion) => {
    const normalized = suggestion.toLowerCase();
    return normalized.includes("consider improving") || normalized.includes("add more detail") || suggestion.trim().length < 12;
  });
}

export function shouldRenderSuggestions(data: InlineSuggestionPayload | null | undefined) {
  if (!data || !data.next_steps) return false;
  if (data.next_steps.length === 0) return false;
  if (isGeneric(data.next_steps)) return false;

  return true;
}

export function shouldShowNextSteps(data: InlineSuggestionPayload | null | undefined) {
  return shouldRenderSuggestions(data);
}

export function shouldRender(data: InlineSuggestionPayload | null | undefined) {
  return shouldRenderSuggestions(data);
}