"use client";

import React from "react";
import { LayoutDashboard, Plus, Sparkles, FileText, Clock, ChevronRight, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";

interface PRD {
  id: string;
  title: string;
  sections: string[];
  status: "draft" | "complete";
  updatedAt: Date;
  wordCount: number;
}

const SAMPLE_PRDS: PRD[] = [
  {
    id: "1",
    title: "Buildcase — AI Product Workspace",
    sections: ["Problem Statement", "Target Users", "Features", "User Stories", "Success Metrics"],
    status: "complete",
    updatedAt: new Date(),
    wordCount: 1240,
  },
  {
    id: "2",
    title: "Insights Engine — V2",
    sections: ["Problem Statement", "Features"],
    status: "draft",
    updatedAt: new Date(Date.now() - 86400000),
    wordCount: 480,
  },
];

const statusConfig = {
  draft: { label: "Draft", className: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20" },
  complete: { label: "Complete", className: "bg-green-400/10 text-green-400 border-green-400/20" },
};

export function PRDsView() {
  const { setActiveView } = useAppStore();
  const [prds] = React.useState<PRD[]>(SAMPLE_PRDS);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [selectedPRD, setSelectedPRD] = React.useState<PRD | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsGenerating(false);
    setActiveView("editor");
  };

  const formatDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="flex h-full bg-background">
      {/* PRD List */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col bg-sidebar">
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">PRDs</span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">{prds.length}</span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleGenerate}
            disabled={isGenerating}
            title="Generate new PRD with AI"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {prds.map(prd => (
            <button
              key={prd.id}
              className={`w-full text-left px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors group ${selectedPRD?.id === prd.id ? "bg-muted" : ""}`}
              onClick={() => setSelectedPRD(prd)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{prd.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{formatDate(prd.updatedAt)}</span>
                    <span className="text-[10px] text-muted-foreground">· {prd.wordCount} words</span>
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-0.5" />
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${statusConfig[prd.status].className}`}>
                  {statusConfig[prd.status].label}
                </span>
              </div>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-border">
          <Button
            className="w-full h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3 w-3" />
            )}
            Generate with AI
          </Button>
        </div>
      </div>

      {/* PRD Preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedPRD ? (
          <>
            <div className="flex items-center justify-between px-8 h-14 border-b border-border shrink-0 bg-card/50">
              <div>
                <h1 className="font-semibold text-sm text-foreground">{selectedPRD.title}</h1>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {selectedPRD.wordCount} words · Updated {formatDate(selectedPRD.updatedAt)}
                </p>
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                <Download className="h-3 w-3" /> Export
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-8 max-w-3xl">
              <div className="space-y-6">
                {selectedPRD.sections.map((section, i) => (
                  <div key={i}>
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{i + 1}. {section}</h2>
                    <div className="h-px bg-border mb-3" />
                    <div className="text-sm text-muted-foreground italic">
                      {section === "Problem Statement" && "Product managers lack a unified AI-native workspace. Existing tools (Notion, Jira) focus on documentation, not decision-making."}
                      {section === "Target Users" && "Aspiring PMs, indie builders, early-stage founders, and startup product teams who need to think and ship faster."}
                      {section === "Features" && "AI Editor, Insight Engine, Decision Engine, PRD Generator, Lightweight Task System."}
                      {section === "User Stories" && "As a PM, I want to transform raw notes into a structured PRD so that I can align my team quickly without hours of writing."}
                      {section === "Edge Cases" && "Handling incomplete inputs, conflicting user signals, and AI hallucinations in product recommendations."}
                      {section === "Success Metrics" && "Time to first PRD < 5 minutes. 70% of users generate at least one PRD. DAU retention > 40% week-over-week."}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <FileText className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">Select a PRD to view</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Or generate a new one from your editor notes using AI.
            </p>
            <Button
              className="mt-4 h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleGenerate}
            >
              <Sparkles className="mr-1.5 h-3 w-3" />
              Generate PRD with AI
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
