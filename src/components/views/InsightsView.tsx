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
      className="flex flex-col h-full transition-colors duration-300"
      style={{ background: "var(--signal-bg)" }}
    >
      {/* Status bar */}
      <div
        className="flex items-center justify-between px-8 py-3.5 border-b shrink-0 bg-white dark:bg-[var(--signal-surface)]"
        style={{ borderColor: "var(--signal-border)" }}
      >
        <span
          className="font-mono text-[10px] uppercase tracking-[0.1em]"
          style={{ color: "var(--signal-text-tertiary)" }}
        >
          EVIDENCE
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: "var(--signal-text-tertiary)" }}
        >
          copilot for product managers
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto p-8 custom-scrollbar">
        {/* Feed header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Brain
              className="h-7 w-7 shrink-0 mt-0.5"
              style={{ color: "var(--signal-accent)" }}
            />
            <div>
              <h1
                className="text-[28px] font-semibold leading-none tracking-tight"
                style={{
                  fontFamily:
                    "var(--font-display, Georgia, 'Times New Roman', serif)",
                  color: "var(--signal-text-primary)",
                }}
              >
                Intelligence Feed
              </h1>
              <span
                className="font-mono text-[11px] uppercase tracking-[0.08em] mt-1 block"
                style={{ color: "var(--signal-text-tertiary)" }}
              >
                {insights.length} {insights.length === 1 ? "Node" : "Nodes"}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setActiveView("editor")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[4px] font-mono text-[12px] font-medium border transition-all hover:bg-[var(--signal-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal-accent)]/40"
              style={{
                borderColor: "var(--signal-border)",
                color: "var(--signal-text-primary)",
                background: "white",
              }}
            >
              + Manual Entry
            </button>
            <button
              onClick={handleExtract}
              disabled={isExtracting || !currentDocId}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[4px] font-mono text-[12px] font-medium text-white transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal-accent)]/40 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--signal-accent)", borderColor: "var(--signal-accent)" }}
            >
              {isExtracting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="text-[13px] leading-none">🔥</span>
              )}
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
              className="px-5 py-2 rounded-full font-mono text-[12px] font-medium whitespace-nowrap border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal-accent)]/40"
              style={
                filter === id
                  ? {
                      background: "var(--signal-accent)",
                      color: "#fff",
                      borderColor: "var(--signal-accent)",
                    }
                  : {
                      background: "white",
                      color: "var(--signal-text-secondary)",
                      borderColor: "var(--signal-border)",
                    }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* Grid / states */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2
              className="h-6 w-6 animate-spin"
              style={{ color: "var(--signal-accent)" }}
            />
            <span
              className="font-mono text-[11px] uppercase tracking-[0.08em] animate-pulse"
              style={{ color: "var(--signal-text-tertiary)" }}
            >
              Fetching Intelligence
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed rounded-xl max-w-2xl mx-auto p-10"
            style={{ borderColor: "var(--signal-border)" }}
          >
            <Brain
              className="h-8 w-8 mb-4"
              style={{ color: "var(--signal-text-tertiary)", opacity: 0.4 }}
            />
            <p
              className="font-mono text-[11px] uppercase tracking-[0.08em] mb-2"
              style={{ color: "var(--signal-text-secondary)" }}
            >
              System Idle
            </p>
            <p
              className="text-[13px] leading-relaxed max-w-xs"
              style={{ color: "var(--signal-text-tertiary)" }}
            >
              Use{" "}
              <span
                className="font-semibold"
                style={{ color: "var(--signal-text-primary)" }}
              >
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
