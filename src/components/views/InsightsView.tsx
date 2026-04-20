"use client";

import React, { useEffect } from "react";
import { Lightbulb, Plus, Sparkles, Tag, TrendingUp, Users, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { getInsights, getDocument, type Insight } from "@/lib/firebase/db";
import { extractInsightsAction } from "@/lib/ai/actions";

const categoryConfig = {
  "pain-point": { label: "Pain Point", icon: AlertCircle, color: "text-primary", bg: "bg-white border-primary/20 hover:border-primary/40" },
  "opportunity": { label: "Opportunity", icon: TrendingUp, color: "text-primary", bg: "bg-white border-primary/10 hover:border-primary/30" },
  "user-segment": { label: "User Segment", icon: Users, color: "text-muted-foreground", bg: "bg-white border-border/60 hover:border-primary/20" },
  "pattern": { label: "Pattern", icon: Tag, color: "text-muted-foreground", bg: "bg-white border-border/60 hover:border-primary/20" },
};

export function InsightsView() {
  const { user } = useAuth();
  const { setActiveView, currentDocId } = useAppStore();
  const [insights, setInsights] = React.useState<Insight[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [filter, setFilter] = React.useState<string>("all");

  const fetchInsights = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await getInsights(user.uid);
      setInsights(data);
    } catch (error) {
      console.error("Failed to fetch insights:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const categories = ["all", "pain-point", "opportunity", "user-segment", "pattern"];
  const filtered = filter === "all" ? insights : insights.filter(i => i.category === filter);

  const handleExtract = async () => {
    if (!user || !currentDocId || isExtracting) return;
    setIsExtracting(true);
    try {
      const doc = await getDocument(user.uid, currentDocId);
      if (!doc || !doc.content) {
        alert("Document is empty. Please add some notes first.");
        return;
      }
      await extractInsightsAction(user.uid, doc.content);
      await fetchInsights();
    } catch (error) {
      console.error("Extraction failed:", error);
      alert("AI extraction failed. Please check your Groq API key.");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background selection:bg-primary/10 transition-all duration-500">
      {/* Header */}
      <div className="flex items-center justify-between px-8 h-14 border-b border-border/60 shrink-0 bg-white/50">
        <div className="flex items-center gap-3">
          <Lightbulb className="h-4 w-4 text-primary" />
          <h1 className="text-sm uppercase tracking-[0.05em] font-semibold">Intelligence Feed</h1>
          <div className="h-4 w-px bg-border/40 mx-1" />
          <span className="label-system text-[12px]">
            {insights.length} nodes
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 label-system text-[12px] hover:text-primary hover:bg-transparent"
            onClick={() => setActiveView("editor")}
          >
            <Plus className="mr-1.5 h-3 w-3" />
            Manual Entry
          </Button>
          <Button
            size="sm"
            className="h-8 label-system text-[12px] bg-primary text-white hover:bg-primary/90 shadow-sm"
            onClick={handleExtract}
            disabled={isExtracting || !currentDocId}
          >
            {isExtracting ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3 w-3" />
            )}
            {isExtracting ? "Processing..." : "Extract with AI"}
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 px-8 py-4 shrink-0 bg-white/20">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-1.5 rounded-md label-system text-[12px] transition-all border ${
              filter === cat
                ? "bg-primary text-white border-primary"
                : "bg-white border-border/60 hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {cat === "all" ? "All Nodes" : categoryConfig[cat as keyof typeof categoryConfig]?.label}
          </button>
        ))}
      </div>

      {/* Insights Grid */}
      <div className="flex-1 overflow-auto p-8 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary/20" />
            <span className="label-system text-[12px] animate-pulse">Fetching Intelligence</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-border/40 rounded-2xl max-w-2xl mx-auto">
            <Lightbulb className="h-8 w-8 text-muted-foreground/20 mb-4" />
            <p className="label-system text-[12px] mb-2">System Idle</p>
            <p className="text-xs text-muted-foreground/60 max-w-sm">
              Use the <span className="font-semibold text-foreground">Extract with AI</span> tool in the editor to populate this feed with structured product notes.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(insight => {
              const cfg = categoryConfig[insight.category] || categoryConfig["opportunity"];
              const Icon = cfg.icon;
              return (
                <div
                  key={insight.id}
                  className={`group rounded-xl border p-6 space-y-4 cursor-default transition-all duration-300 shadow-sm hover:shadow-md ${cfg.bg}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
                    <span className="label-system text-[12px]">
                      {cfg.label}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground leading-snug tracking-tight">{insight.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed transition-all group-hover:text-foreground">{insight.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

