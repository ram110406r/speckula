"use client";

import React, { useEffect } from "react";
import { LayoutDashboard, Plus, Sparkles, FileText, Clock, ChevronRight, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { getPRDs, getDocument, type PRD } from "@/lib/firebase/db";
import { generatePRDAction } from "@/lib/ai/actions";

const statusConfig = {
  draft: { label: "Draft", className: "bg-muted/10 text-muted-foreground border-border" },
  complete: { label: "Approved", className: "bg-primary/5 text-primary border-primary/20" },
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
    <div className="flex h-full bg-background transition-all duration-300">
      {/* PRD List */}
      <div className="w-80 shrink-0 border-r border-border/60 flex flex-col bg-background">
        <div className="flex items-center justify-between px-6 h-14 border-b border-border/60 shrink-0 bg-white/20">
          <div className="flex items-center gap-2.5">
            <LayoutDashboard className="h-4 w-4 text-primary" />
            <span className="font-bold text-[10px] uppercase tracking-widest text-foreground">Specifications</span>
            <span className="text-[10px] bg-muted/20 px-1.5 py-0.5 rounded-sm text-muted-foreground font-bold">{prds.length}</span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-primary transition-colors"
            onClick={handleGenerate}
            disabled={isGenerating || !currentDocId}
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-1 p-2 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary/20" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30">Syncing PRDs</span>
            </div>
          ) : prds.length === 0 ? (
            <div className="text-center py-12 px-6 border border-dashed border-border/40 rounded-xl m-2">
              <p className="text-[10px] text-muted-foreground/60 font-medium leading-relaxed italic">No specifications generated yet. Use the system to synthesize one from your notes.</p>
            </div>
          ) : (
            prds.map(prd => (
              <button
                key={prd.id}
                className={`w-full text-left px-4 py-4 rounded-lg transition-all group relative border ${
                  selectedPRD?.id === prd.id 
                    ? "bg-white border-primary/20 shadow-sm" 
                    : "border-transparent hover:bg-white/40"
                }`}
                onClick={() => setSelectedPRD(prd)}
              >
                {selectedPRD?.id === prd.id && (
                  <div className="absolute left-0 top-3 bottom-3 w-[2.5px] bg-primary rounded-r-full" />
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate leading-tight transition-colors ${selectedPRD?.id === prd.id ? "text-primary" : "text-foreground"}`}>
                      {prd.title}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="h-2.5 w-2.5 text-muted-foreground/40" />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
                        {formatDate(prd.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-3">
                  <span className={`text-[8px] px-2 py-0.5 rounded-sm border font-bold uppercase tracking-widest ${statusConfig[prd.status]?.className || statusConfig.draft.className}`}>
                    {statusConfig[prd.status]?.label || "Draft"}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
        
        <div className="p-4 border-t border-border/60 bg-white/10">
          <Button
            className="w-full h-10 text-[10px] font-bold uppercase tracking-widest bg-primary text-white hover:bg-primary-hover shadow-sm"
            onClick={handleGenerate}
            disabled={isGenerating || !currentDocId}
          >
            {isGenerating ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-3.5 w-3.5" />
            )}
            {isGenerating ? "Synthesizing..." : "Generate Specs"}
          </Button>
        </div>
      </div>

      {/* PRD Preview */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white/20">
        {selectedPRD ? (
          <>
            <div className="flex items-center justify-between px-10 h-14 border-b border-border/60 shrink-0 bg-white/50 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <FileText className="h-4 w-4 text-primary/60" />
                <div>
                  <h1 className="font-bold text-sm tracking-tight text-foreground">{selectedPRD.title}</h1>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      Last Synthesized {formatDate(selectedPRD.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold uppercase tracking-widest border-border hover:border-primary/40 hover:text-primary px-4 bg-white transition-all">
                <Download className="h-3 w-3 mr-1.5" /> Export Specs
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-12 custom-scrollbar">
              <div className="max-w-3xl mx-auto">
                <div className="whitespace-pre-wrap text-[15px] font-medium text-foreground leading-[1.7] selection:bg-primary/10 tracking-tight">
                  {selectedPRD.content}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-20 text-center h-full max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-muted/10 border border-border/40 flex items-center justify-center mb-6">
              <FileText className="h-8 w-8 text-muted-foreground/20" />
            </div>
            <h2 className="text-xl font-bold tracking-tight mb-2">Workspace Empty</h2>
            <p className="text-sm text-muted-foreground leading-relaxed font-medium mb-8">
              Select an existing specification from the sidebar or generate a new one using your current research notes.
            </p>
            <Button
              className="h-12 px-8 text-[11px] font-bold uppercase tracking-widest bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/10 transition-all rounded-lg"
              onClick={handleGenerate}
              disabled={isGenerating || !currentDocId}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Synthesize New PRD
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

