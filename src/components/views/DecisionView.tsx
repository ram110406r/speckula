"use client";

import React, { useEffect } from "react";
import { Compass, Sparkles, Loader2, Target, Zap, Users, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { getDocument } from "@/lib/firebase/db";
import { suggestDirectionAction } from "@/lib/ai/actions";

interface DecisionSuggestion {
  title: string;
  justification: string;
  priority: "high" | "medium" | "low";
  impact: number;
  effort: number;
  userStory: string;
}

const priorityColors = {
  high: "text-primary border-primary/20 bg-primary/5",
  medium: "text-muted-foreground border-border bg-muted/5",
  low: "text-muted-foreground/60 border-border/40 bg-transparent",
};

export function DecisionView() {
  const { user } = useAuth();
  const { currentDocId } = useAppStore();
  const [suggestions, setSuggestions] = React.useState<DecisionSuggestion[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleGenerate = async () => {
    if (!user || !currentDocId || isLoading) return;
    setIsLoading(true);
    try {
      const doc = await getDocument(user.uid, currentDocId);
      if (!doc || !doc.content) {
        alert("Document is empty. Please add some notes first.");
        return;
      }
      const data = await suggestDirectionAction(user.uid, doc.content);
      setSuggestions(data);
    } catch (error) {
      console.error("Decision generation failed:", error);
      alert("AI decision engine failed to generate suggestions.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-8 h-14 border-b border-border/60 shrink-0 bg-white/50">
        <div className="flex items-center gap-2.5">
          <Compass className="h-4 w-4 text-primary" />
          <span className="label-system text-[12px]">Decision Engine</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 label-system text-[12px] hover:text-primary hover:bg-transparent"
          onClick={handleGenerate}
          disabled={isLoading || !currentDocId}
        >
          {isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          {isLoading ? "Synthesizing Direction..." : "Ask: What to build next?"}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-10 space-y-12 max-w-5xl custom-scrollbar">
        {suggestions.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 text-center border-2 border-dashed border-border/40 rounded-2xl max-w-2xl mx-auto">
            <Target className="h-10 w-10 text-muted-foreground/20 mb-6" />
            <p className="label-system text-[12px] mb-2 uppercase tracking-widest">Strategic Void</p>
            <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto leading-relaxed mb-8">
              No product direction has been synthesized yet. Launch the Decision Engine to transform your research into a prioritized feature roadmap.
            </p>
            <Button 
              className="bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/10 rounded-lg px-8 label-system text-[12px]"
              onClick={handleGenerate}
              disabled={!currentDocId}
            >
              <Zap className="mr-2 h-3.5 w-3.5" />
              Analyze Product Context
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Brain className="h-8 w-8 animate-pulse text-primary/40" />
            <span className="label-system text-[12px] animate-pulse">Running Competitive & Contextual Analysis</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {suggestions.map((s, i) => (
              <div key={i} className="flex flex-col bg-white border border-border shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-all hover:border-primary/20 group">
                <div className="p-5 flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`label-system text-[10px] px-2 py-0.5 rounded-sm border ${priorityColors[s.priority]}`}>
                      {s.priority} priority
                    </span>
                    <div className="flex items-center gap-2">
                       <Users className="h-3 w-3 text-muted-foreground/40" />
                       <span className="label-system text-[10px] text-muted-foreground/60">Target Alpha</span>
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold mb-3 group-hover:text-primary transition-colors leading-tight">
                    {s.title}
                  </h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed mb-4 italic border-l-2 border-primary/10 pl-3">
                    {s.justification}
                  </p>
                  <p className="text-[12px] text-foreground font-medium leading-relaxed bg-muted/20 p-2.5 rounded-lg border border-border/40">
                    <span className="label-system text-[10px] block mb-1 opacity-60">User Story</span>
                    {s.userStory}
                  </p>
                </div>
                <div className="px-5 py-4 bg-muted/10 border-t border-border/40 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="label-system text-[9px] uppercase opacity-60">Estimated Impact</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 w-16 bg-border/40 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${s.impact * 10}%` }} />
                      </div>
                      <span className="label-system text-[11px] font-bold">{s.impact}/10</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <span className="label-system text-[9px] uppercase opacity-60">Dev Effort</span>
                    <div className="flex items-center gap-1.5">
                      <span className="label-system text-[11px] font-bold">{s.effort}/10</span>
                      <div className="flex-1 h-1.5 w-16 bg-border/40 rounded-full overflow-hidden">
                        <div className="h-full bg-muted-foreground/40" style={{ width: `${s.effort * 10}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
