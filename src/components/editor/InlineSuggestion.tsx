import React from "react";
import { Loader2, Target, AlertTriangle, LineChart, HelpCircle, Check, X } from "lucide-react";
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
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (!loading && !suggestion) {
    return null;
  }

  const typeConfig = {
    problem: { label: "Problem Stage", icon: Target },
    solution: { label: "Solution Stage", icon: AlertTriangle },
    metrics: { label: "Metrics Stage", icon: LineChart },
    exploration: { label: "Exploration Stage", icon: HelpCircle },
  } as const;

  const suggestionType = suggestion?.stage ?? "exploration";
  const TypeIcon = typeConfig[suggestionType].icon;
  const rows = suggestion?.next_steps ?? [];
  const visibleRows = isExpanded ? rows : rows.slice(0, 1);

  return (
    <div
      className="pointer-events-auto absolute z-30 w-[min(420px,calc(100%-2rem))] rounded-xl border border-border/80 bg-background/95 p-3 shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-1 duration-150 opacity-90 hover:opacity-100"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Thinking with your current context...
        </div>
      ) : suggestion ? (
        <>
          <div className="space-y-2 border-l-2 border-primary/15 pl-2 text-[12px] leading-relaxed text-muted-foreground">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground/80">
              <TypeIcon className="h-3.5 w-3.5 text-primary/80" />
              → Thinking Guide
            </p>
            <ul className="space-y-1.5">
              {visibleRows.map((row, index) => (
                <li key={`${row}-${index}`} className="flex items-start gap-2">
                  <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-primary/60" />
                  <span>{row}</span>
                </li>
              ))}
            </ul>
            {!isExpanded && rows.length > 1 && (
              <p className="text-[10px] text-muted-foreground/70">Hover to expand</p>
            )}
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
