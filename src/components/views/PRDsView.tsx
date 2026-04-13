"use client";

import React, { useEffect } from "react";
import { LayoutDashboard, Plus, Sparkles, FileText, Clock, ChevronRight, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { getPRDs, getDocument, type PRD } from "@/lib/firebase/db";
import { generatePRDAction } from "@/lib/ai/actions";

const statusConfig = {
  draft: { label: "Draft", className: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20" },
  complete: { label: "Complete", className: "bg-green-400/10 text-green-400 border-green-400/20" },
};

export function PRDsView() {
  const { user } = useAuth();
  const { setActiveView, currentDocId, documents } = useAppStore();
  const [prds, setPrds] = React.useState<PRD[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [selectedPRD, setSelectedPRD] = React.useState<PRD | null>(null);

  const fetchPRDs = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await getPRDs(user.uid);
      setPrds(data);
    } catch (error) {
      console.error("Failed to fetch PRDs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPRDs();
  }, [user]);

  const handleGenerate = async () => {
    if (!user || !currentDocId || isGenerating) return;
    setIsGenerating(true);
    try {
      const doc = await getDocument(user.uid, currentDocId);
      if (!doc || !doc.content) {
        alert("Document is empty. Please add some notes first.");
        return;
      }
      const title = documents.find(d => d.id === currentDocId)?.title || "Untitled Document";
      await generatePRDAction(user.uid, doc.content, title);
      await fetchPRDs();
    } catch (error) {
      console.error("Generation failed:", error);
      alert("AI PRD generation failed. Please check your config.");
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDate = (d: any) => {
    if (!d) return "Recently";
    const date = d.toDate ? d.toDate() : new Date(d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

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
            disabled={isGenerating || !currentDocId}
            title="Generate new PRD with AI"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>
        
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" />
            </div>
          ) : prds.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="text-[10px] text-muted-foreground italic leading-relaxed"> No PRDs generated yet. Use the AI to generate one from your notes.</p>
            </div>
          ) : (
            prds.map(prd => (
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
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-0.5" />
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${statusConfig[prd.status]?.className || statusConfig.draft.className}`}>
                    {statusConfig[prd.status]?.label || "Draft"}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
        
        <div className="p-3 border-t border-border">
          <Button
            className="w-full h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleGenerate}
            disabled={isGenerating || !currentDocId}
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
                  Updated {formatDate(selectedPRD.updatedAt)}
                </p>
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                <Download className="h-3 w-3" /> Export
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-8 max-w-4xl">
              <div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                {selectedPRD.content}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <FileText className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">Select a PRD to view</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {currentDocId ? "Or generate a new one from your active document using AI." : "Create a document first to generate PRDs."}
            </p>
            <Button
              className="mt-4 h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleGenerate}
              disabled={isGenerating || !currentDocId}
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

