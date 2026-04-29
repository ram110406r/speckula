"use client";

import React from "react";
import { Loader2, Brain } from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { getInsights, getDocument, type Insight } from "@/lib/firebase/db";
import { extractInsightsAction } from "@/lib/ai/actions";
import { NodeCard } from "@/components/signals/NodeCard";

type FilterKey = "all" | "pain-point" | "opportunity" | "user-segment" | "pattern";

const FILTER_PILLS: { id: FilterKey; label: string }[] = [
  { id: "all", label: "All Nodes" },
  { id: "pain-point", label: "Pain Point" },
  { id: "opportunity", label: "Opportunity" },
  { id: "user-segment", label: "User Segment" },
  { id: "pattern", label: "Pattern" },
];

export function InsightsView() {
  const { user } = useAuth();
  const { setActiveView, currentDocId } = useAppStore();
  const [insights, setInsights] = React.useState<Insight[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [filter, setFilter] = React.useState<FilterKey>("all");

  const fetchInsights = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await getInsights(user.uid);
      setInsights(
        currentDocId
          ? data.filter((insight) => insight.sourceDocId === currentDocId)
          : []
      );
    } catch (error) {
      console.error("Failed to fetch insights:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, currentDocId]);

  React.useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const filtered: Insight[] =
    filter === "all" ? insights : insights.filter((i) => i.category === filter);

  const handleExtract = async () => {
    if (!user || !currentDocId || isExtracting) return;
    setIsExtracting(true);
    try {
      const doc = await getDocument(user.uid, currentDocId);
      if (!doc || !doc.content) {
        alert("Document is empty. Please add some notes first.");
        return;
      }
      await extractInsightsAction(user.uid, doc.content, currentDocId);
      await fetchInsights();
    } catch (error) {
      console.error("Extraction failed:", error);
      alert("AI extraction failed. Please check your Groq API key.");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div
      className="flex flex-col h-full transition-colors duration-300 bg-background"
    >
      {/* Status bar */}
      <div className="flex items-center justify-between px-8 py-3.5 border-b border-border shrink-0 bg-card">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">
          EVIDENCE
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/60">
          copilot for product managers
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto p-8 custom-scrollbar">
        {/* Feed header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Brain className="h-7 w-7 shrink-0 mt-0.5 text-primary" />
            <div>
              <h1 className="text-[28px] font-semibold leading-none tracking-tight text-foreground">
                Intelligence Feed
              </h1>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] mt-1 block text-muted-foreground/60">
                {insights.length} {insights.length === 1 ? "Node" : "Nodes"}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setActiveView("editor")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[4px] font-mono text-[12px] font-medium border border-border bg-card text-foreground transition-all hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              + Manual Entry
            </button>
            <button
              onClick={handleExtract}
              disabled={isExtracting || !currentDocId}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[4px] font-mono text-[12px] font-medium text-primary-foreground bg-primary transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isExtracting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isExtracting ? "Processing…" : "Extract with AI"}
            </button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
          {FILTER_PILLS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              aria-current={filter === id ? "page" : undefined}
              className={`px-5 py-2 rounded-full font-mono text-[12px] font-medium whitespace-nowrap border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                filter === id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Grid / states */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] animate-pulse text-muted-foreground/60">
              Fetching Intelligence
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-border rounded-xl max-w-2xl mx-auto p-10">
            <Brain className="h-8 w-8 mb-4 text-muted-foreground/40" />
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] mb-2 text-muted-foreground">
              System Idle
            </p>
            <p className="text-[13px] leading-relaxed max-w-xs text-muted-foreground/60">
              Use{" "}
              <span className="font-semibold text-foreground">
                Extract with AI
              </span>{" "}
              to populate this feed with structured product signals.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((insight, i) => (
              <NodeCard
                key={insight.id}
                insight={insight}
                animationDelay={i * 60}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
