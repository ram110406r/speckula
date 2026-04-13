"use client";

import React, { useEffect } from "react";
import { Lightbulb, Plus, Sparkles, Tag, TrendingUp, Users, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { getInsights, getDocument, type Insight } from "@/lib/firebase/db";
import { extractInsightsAction } from "@/lib/ai/actions";

const categoryConfig = {
  "pain-point": { label: "Pain Point", icon: AlertCircle, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
  "opportunity": { label: "Opportunity", icon: TrendingUp, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  "user-segment": { label: "User Segment", icon: Users, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  "pattern": { label: "Pattern", icon: Tag, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
};

export function InsightsView() {
  const { user } = useAuth();
  const { setActiveView, currentDocId } = useAppStore();
  const [insights, setInsights] = React.useState<Insight[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [filter, setFilter] = React.useState<string>("all");

  const fetchInsights = async () => {
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
  };

  useEffect(() => {
    fetchInsights();
  }, [user]);

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
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-8 h-14 border-b border-border shrink-0 bg-card/50">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-400" />
          <h1 className="font-semibold text-sm">Product Insights</h1>
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-medium">
            {insights.length} insights
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-primary/20 hover:border-primary/50 hover:bg-primary/5"
            onClick={() => setActiveView("editor")}
          >
            <Plus className="mr-1.5 h-3 w-3 text-primary" />
            Add from Editor
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleExtract}
            disabled={isExtracting || !currentDocId}
          >
            {isExtracting ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3 w-3" />
            )}
            {isExtracting ? "Extracting..." : "Extract with AI"}
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-8 py-3 border-b border-border/50 shrink-0">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium capitalize transition-colors ${
              filter === cat
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat === "all" ? "All" : categoryConfig[cat as keyof typeof categoryConfig]?.label}
          </button>
        ))}
      </div>

      {/* Insights Grid */}
      <div className="flex-1 overflow-auto p-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Lightbulb className="h-10 w-10 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No insights yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Write product notes in the Editor and use <strong>Extract with AI</strong> to generate insights.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            {filtered.map(insight => {
              const cfg = categoryConfig[insight.category] || categoryConfig["opportunity"];
              const Icon = cfg.icon;
              return (
                <div
                  key={insight.id}
                  className={`rounded-xl border p-4 space-y-2 cursor-pointer hover:shadow-md transition-shadow ${cfg.bg}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
                    <span className={`text-[10px] uppercase tracking-wider font-semibold ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground leading-snug">{insight.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

