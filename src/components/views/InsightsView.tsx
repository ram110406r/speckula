"use client";

import React from "react";
import { Lightbulb, Plus, Sparkles, Tag, TrendingUp, Users, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";

interface Insight {
  id: string;
  category: "pain-point" | "opportunity" | "user-segment" | "pattern";
  title: string;
  description: string;
  createdAt: Date;
}

const categoryConfig = {
  "pain-point": { label: "Pain Point", icon: AlertCircle, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
  "opportunity": { label: "Opportunity", icon: TrendingUp, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  "user-segment": { label: "User Segment", icon: Users, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  "pattern": { label: "Pattern", icon: Tag, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
};

const SAMPLE_INSIGHTS: Insight[] = [
  {
    id: "1",
    category: "pain-point",
    title: "Fragmented product workflows",
    description: "PMs are context-switching between 6+ tools (Notion, Jira, Miro, Docs, Slack) losing 2–3 hours of focused thinking daily.",
    createdAt: new Date(),
  },
  {
    id: "2",
    category: "opportunity",
    title: "AI PRD generation can replace 4 hours of writing",
    description: "Users spending 3–5 hours on a single PRD could reduce that to under 15 minutes with AI-assisted generation from raw notes.",
    createdAt: new Date(),
  },
  {
    id: "3",
    category: "user-segment",
    title: "Aspiring PMs & indie builders",
    description: "Non-PMs (engineers, designers, founders) who don't have formal product training but need to make product decisions daily.",
    createdAt: new Date(),
  },
  {
    id: "4",
    category: "pattern",
    title: "Decisions made without structured frameworks",
    description: "Most early-stage teams prioritize based on intuition rather than data, leading to feature regret and wasted sprints.",
    createdAt: new Date(),
  },
];

export function InsightsView() {
  const { user } = useAuth();
  const { setActiveView } = useAppStore();
  const [insights] = React.useState<Insight[]>(SAMPLE_INSIGHTS);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [filter, setFilter] = React.useState<string>("all");

  const categories = ["all", "pain-point", "opportunity", "user-segment", "pattern"];
  const filtered = filter === "all" ? insights : insights.filter(i => i.category === filter);

  const handleExtract = async () => {
    setIsExtracting(true);
    // Simulate extraction — in the future, reads the active document from Firestore
    await new Promise(r => setTimeout(r, 1800));
    setIsExtracting(false);
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
            disabled={isExtracting}
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
        {filtered.length === 0 ? (
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
              const cfg = categoryConfig[insight.category];
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
