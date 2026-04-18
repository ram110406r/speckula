import React from "react";
import { Loader2, Lightbulb, AlertTriangle, Rocket, Check, X } from "lucide-react";
import type { InlineSuggestionPayload } from "@/lib/ai/actions";

interface InlineSuggestionProps {
  suggestion: InlineSuggestionPayload | null;
  loading: boolean;
  position: { x: number; y: number };
  onAccept: () => void;
  onDismiss: () => void;
}

export function InlineSuggestion({
  suggestion,
  loading,
  position,
  onAccept,
  onDismiss,
}: InlineSuggestionProps) {
  if (!loading && !suggestion) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto absolute z-30 w-[min(420px,calc(100%-2rem))] rounded-xl border border-border/80 bg-background/95 p-3 shadow-lg backdrop-blur-sm"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      role="status"
      aria-live="polite"
    >
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Thinking with your current context...
        </div>
      ) : suggestion ? (
        <>
          <div className="space-y-2 text-[12px] leading-relaxed text-muted-foreground">
            <p className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 text-primary/80" />
              <span>{suggestion.insight}</span>
            </p>
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-primary/70" />
              <span>{suggestion.gap}</span>
            </p>
            <p className="flex items-start gap-2 text-foreground">
              <Rocket className="mt-0.5 h-3.5 w-3.5 text-primary" />
              <span>{suggestion.action}</span>
            </p>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/50 pt-2">
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Dismiss Esc
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Check className="h-3 w-3" />
              Accept Tab
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
