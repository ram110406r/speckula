"use client";

import React from "react";
import { Loader2, Brain, Download, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { subscribeToInsights, getDocument, deleteInsight, updateInsight, type Insight } from "@/lib/firebase/db";
import { extractInsightsAction } from "@/lib/ai/actions";
import { generateInsightsMarkdown, downloadMarkdown, downloadInsightsDocx } from "@/lib/export";
import { toast } from "@/store/useToastStore";
import { exportDialog } from "@/store/useExportDialogStore";
import { NodeCard } from "@/components/signals/NodeCard";

type FilterKey = "all" | "pain-point" | "opportunity" | "user-segment" | "pattern";

const FILTER_PILLS: { id: FilterKey; label: string }[] = [
  { id: "all",          label: "All Nodes"    },
  { id: "pain-point",   label: "Pain Point"   },
  { id: "opportunity",  label: "Opportunity"  },
  { id: "user-segment", label: "User Segment" },
  { id: "pattern",      label: "Pattern"      },
];

export function InsightsView() {
  const { user } = useAuth();
  const { setActiveView, currentDocId, setPendingInsightForDecision, setPhaseHasContent } = useAppStore();
  const [insights, setInsights] = React.useState<Insight[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    const unsub = subscribeToInsights(
      user.uid,
      (data) => {
        const filtered = currentDocId ? data.filter((i) => i.sourceDocId === currentDocId) : [];
        setInsights(filtered);
        setPhaseHasContent({ insights: filtered.length > 0 });
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );
    return unsub;
  }, [user, currentDocId, setPhaseHasContent]);

  const filtered: Insight[] = filter === "all" ? insights : insights.filter((i) => i.category === filter);

  // ── delete single ────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteInsight(user.uid, id);
      setInsights((prev) => prev.filter((i) => i.id !== id));
      toast.success("Signal deleted");
    } catch {
      toast.error("Failed to delete signal");
    }
  };

  // ── inline edit ──────────────────────────────────────────────────────────────
  const handleUpdate = async (id: string, title: string, description: string) => {
    if (!user) return;
    try {
      await updateInsight(user.uid, id, { title, description });
      setInsights((prev) => prev.map((i) => i.id === id ? { ...i, title, description } : i));
      toast.success("Signal updated");
    } catch {
      toast.error("Failed to update signal");
    }
  };

  // ── bulk select / delete ─────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!user || selected.size === 0) return;
    const ids = [...selected];
    try {
      await Promise.all(ids.map((id) => deleteInsight(user.uid, id)));
      setInsights((prev) => prev.filter((i) => !ids.includes(i.id!)));
      setSelected(new Set());
      setSelectMode(false);
      toast.success(`${ids.length} signal${ids.length > 1 ? "s" : ""} deleted`);
    } catch {
      toast.error("Bulk delete failed");
    }
  };

  // ── export ───────────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (insights.length === 0) { toast.warning("No signals to export"); return; }
    exportDialog.open({
      defaultFilename: "product-signals",
      formats: [
        { value: "md",   label: "Markdown (.md)"       },
        { value: "docx", label: "Word document (.docx)" },
      ],
      onExport: async (filename, format) => {
        if (format === "md") downloadMarkdown(generateInsightsMarkdown(insights), filename);
        else await downloadInsightsDocx(insights, filename);
        toast.success("Signals exported", `${insights.length} signals saved as .${format}`);
      },
    });
  };

  // ── convert insight → decision ───────────────────────────────────────────────
  const handleConvertToDecision = (insight: Insight) => {
    setPendingInsightForDecision({ title: insight.title, description: insight.description ?? "" });
    setActiveView("decisions");
  };

  // ── extract ──────────────────────────────────────────────────────────────────
  const handleExtract = async () => {
    if (!user || !currentDocId || isExtracting) return;
    setIsExtracting(true);
    try {
      const doc = await getDocument(user.uid, currentDocId);
      if (!doc?.content) { toast.warning("Document is empty"); return; }
      await extractInsightsAction(user.uid, doc.content, currentDocId);
      toast.success("Extraction complete");
    } catch {
      toast.error("AI extraction failed", "Check your Groq API key");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="flex flex-col h-full transition-colors duration-300 bg-background">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 md:px-8 py-3.5 border-b border-border shrink-0 bg-card">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">EVIDENCE</span>
        <span className="font-mono text-[10px] text-muted-foreground/60">speckula</span>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar">
        {/* Feed header */}
        <div className="flex items-start justify-between gap-4 mb-4 md:mb-8 flex-wrap">
          <div className="flex items-center gap-4">
            <Brain className="h-7 w-7 shrink-0 mt-0.5 text-primary" />
            <div>
              <h1 className="text-xl sm:text-[28px] font-semibold leading-none tracking-tight text-foreground">Intelligence Feed</h1>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] mt-1 block text-muted-foreground/60">
                {insights.length} {insights.length === 1 ? "Node" : "Nodes"}
                {selectMode && selected.size > 0 && ` · ${selected.size} selected`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap justify-end w-full sm:w-auto">
            {/* Bulk delete toolbar */}
            {selectMode && (
              <>
                {selected.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-[4px] font-mono text-[12px] font-medium text-destructive border border-destructive/40 bg-destructive/5 hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete {selected.size}
                  </button>
                )}
                <button
                  onClick={() => { setSelectMode(false); setSelected(new Set()); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[4px] font-mono text-[12px] font-medium border border-border bg-card text-foreground hover:bg-muted transition-all"
                >
                  Cancel
                </button>
              </>
            )}

            {!selectMode && (
              <>
                <button
                  onClick={() => setSelectMode(true)}
                  disabled={insights.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[4px] font-mono text-[12px] font-medium border border-border bg-card text-foreground transition-all hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Select
                </button>
                <button
                  onClick={handleExport}
                  disabled={insights.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[4px] font-mono text-[12px] font-medium border border-border bg-card text-foreground transition-all hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="h-3.5 w-3.5" /> Export
                </button>
                <button
                  onClick={() => setActiveView("editor")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[4px] font-mono text-[12px] font-medium border border-border bg-card text-foreground transition-all hover:bg-muted"
                >
                  + Manual Entry
                </button>
                <button
                  onClick={handleExtract}
                  disabled={isExtracting || !currentDocId}
                  className="flex items-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-[4px] font-mono text-[12px] font-medium text-primary-foreground bg-primary transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isExtracting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isExtracting ? "Processing…" : "Extract with AI"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 mb-4 md:mb-8 overflow-x-auto pb-1">
          {FILTER_PILLS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              aria-current={filter === id ? "page" : undefined}
              className={`px-5 py-2 rounded-full font-mono text-[12px] font-medium whitespace-nowrap border transition-all ${
                filter === id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground"
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
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] animate-pulse text-muted-foreground/60">Fetching Intelligence</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-border rounded-xl max-w-2xl mx-auto p-10">
            <Brain className="h-8 w-8 mb-4 text-muted-foreground/40" />
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] mb-2 text-muted-foreground">System Idle</p>
            <p className="text-[13px] leading-relaxed max-w-xs text-muted-foreground/60">
              Use <span className="font-semibold text-foreground">Extract with AI</span> to populate this feed with structured product signals.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((insight, i) => (
              <div key={insight.id} className="relative">
                {selectMode && (
                  <button
                    onClick={() => toggleSelect(insight.id!)}
                    className={`absolute top-3 left-3 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selected.has(insight.id!)
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-card border-border"
                    }`}
                  >
                    {selected.has(insight.id!) && <span className="text-[10px] font-bold">✓</span>}
                  </button>
                )}
                <NodeCard
                  insight={insight}
                  animationDelay={i * 60}
                  onDelete={!selectMode ? handleDelete : undefined}
                  onUpdate={!selectMode ? handleUpdate : undefined}
                  onConvertToDecision={!selectMode ? handleConvertToDecision : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
