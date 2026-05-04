"use client";

import React, { useEffect } from "react";
import { LayoutDashboard, Plus, FileText, Clock, Loader2, Download, Copy, Sparkles, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { getPRDs, getDocument, type PRD } from "@/lib/firebase/db";
import { generatePRDAction, tipTapToText } from "@/lib/ai/actions";
import { downloadMarkdown, downloadPRDDocx, copyToClipboard, slugify } from "@/lib/export";
import { toast } from "@/store/useToastStore";
import { exportDialog } from "@/store/useExportDialogStore";

const statusConfig = {
  draft: { label: "Draft", className: "bg-muted/10 text-muted-foreground border-border" },
  complete: { label: "Approved", className: "bg-primary/5 text-primary border-primary/20" },
};

export function PRDsView() {
  const { user } = useAuth();
  const { currentDocId, documents } = useAppStore();
  const [prds, setPrds] = React.useState<PRD[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [selectedPRD, setSelectedPRD] = React.useState<PRD | null>(null);

  const fetchPRDs = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await getPRDs(user.uid);
      setPrds(currentDocId ? data.filter((prd) => prd.sourceDocId === currentDocId) : []);
    } catch (error) {
      console.error("Failed to fetch PRDs:", error);
      toast.error("Couldn't load specs", "Check that Firestore rules are deployed and you're signed in.");
    } finally {
      setIsLoading(false);
    }
  }, [user, currentDocId]);

  useEffect(() => {
    fetchPRDs();
  }, [fetchPRDs]);

  useEffect(() => {
    setSelectedPRD(null);
  }, [currentDocId]);

  const handleExport = () => {
    if (!selectedPRD) return;
    exportDialog.open({
      defaultFilename: slugify(selectedPRD.title),
      formats: [
        { value: "md",   label: "Markdown (.md)" },
        { value: "docx", label: "Word document (.docx)" },
      ],
      onExport: async (filename, format) => {
        const md = `# ${selectedPRD.title}\n\n${selectedPRD.content}`;
        if (format === "md") {
          downloadMarkdown(md, filename);
        } else {
          await downloadPRDDocx(selectedPRD.title, selectedPRD.content, filename);
        }
        toast.success("Spec exported", `Saved as .${format}`);
      },
    });
  };

  const handleCopy = async () => {
    if (!selectedPRD) return;
    const md = `# ${selectedPRD.title}\n\n${selectedPRD.content}`;
    const ok = await copyToClipboard(md);
    if (ok) toast.success("Copied to clipboard");
    else toast.error("Copy failed", "Try selecting and copying manually");
  };

  const handleGenerate = async () => {
    if (!user || !currentDocId || isGenerating) return;
    setIsGenerating(true);
    try {
      const doc = await getDocument(user.uid, currentDocId);
      if (!doc || !tipTapToText(doc.content).trim()) {
        toast.error("Document is empty", "Add some research notes first, then generate a spec.");
        return;
      }
      const title = documents.find(d => d.id === currentDocId)?.title || "Untitled Document";
      await generatePRDAction(user.uid, doc.content, title, currentDocId);
      await fetchPRDs();
    } catch (error) {
      console.error("Generation failed:", error);
      toast.error("Spec generation failed", "Check your API config and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDate = (d: unknown) => {
    if (!d) return "Recently";
    const maybeTimestamp = d as { toDate?: () => Date };
    const date = typeof maybeTimestamp.toDate === "function" ? maybeTimestamp.toDate() : new Date(d as string | number | Date);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-background transition-all duration-300">
      {/* PRD List — full width on mobile, fixed sidebar on desktop; hidden on mobile when a PRD is open */}
      <div className={`${selectedPRD ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-border/60 bg-background`}>
        <div className="flex items-center justify-between px-6 h-14 border-b border-border/60 shrink-0 bg-card/20">
          <div className="flex items-center gap-2.5">
            <LayoutDashboard className="h-4 w-4 text-primary" />
            <span className="label-system text-[12px]">Specifications</span>
            <span className="label-system text-[12px] bg-muted/20 px-1.5 py-0.5 rounded-sm">{prds.length}</span>
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
              <span className="label-system text-[12px] animate-pulse">Syncing PRDs</span>
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
                    ? "bg-card border-primary/20 shadow-sm" 
                    : "border-transparent hover:bg-card/40"
                }`}
                onClick={() => setSelectedPRD(prd)}
              >
                {selectedPRD?.id === prd.id && (
                  <div className="absolute left-0 top-3 bottom-3 w-[2.5px] bg-primary rounded-r-full" />
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate leading-tight transition-colors ${selectedPRD?.id === prd.id ? "text-primary" : "text-foreground"}`}>
                      {prd.title}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="h-2.5 w-2.5 text-muted-foreground/40" />
                      <span className="label-system text-[12px]">
                        {formatDate(prd.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-3">
                  <span className={`label-system text-[12px] px-2 py-0.5 rounded-sm border ${statusConfig[prd.status]?.className || statusConfig.draft.className}`}>
                    {statusConfig[prd.status]?.label || "Draft"}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
        
        <div className="p-4 border-t border-border/60 bg-card/10">
          <Button
            className="w-full h-10 label-system text-[12px] bg-primary text-white hover:bg-primary-hover shadow-sm"
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

      {/* PRD Preview — full-screen on mobile when a PRD is selected, flex-1 on desktop */}
      <div className={`${!selectedPRD ? "hidden md:flex" : "flex"} flex-1 flex-col overflow-hidden bg-card/20`}>
        {selectedPRD ? (
          <>
            <div className="flex items-center justify-between px-4 md:px-10 h-14 border-b border-border/60 shrink-0 bg-card/50 backdrop-blur-md">
              <div className="flex items-center gap-2 md:gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedPRD(null)}
                  className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Back to list"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <FileText className="h-4 w-4 text-primary/60 hidden md:block" />
                <div>
                  <h1 className="text-sm tracking-tight text-foreground font-semibold uppercase tracking-[0.05em]">Specification</h1>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                    <p className="label-system text-[12px]">
                      Last Synthesized {formatDate(selectedPRD.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleCopy} className="h-10 sm:h-8 label-system text-[12px] border-border hover:border-primary/40 hover:text-primary px-3 bg-card transition-all">
                  <Copy className="h-3 w-3 mr-1.5" /><span className="hidden xs:inline">Copy</span>
                </Button>
                <Button size="sm" variant="outline" onClick={handleExport} className="h-10 sm:h-8 label-system text-[12px] border-border hover:border-primary/40 hover:text-primary px-3 bg-card transition-all">
                  <Download className="h-3 w-3 mr-1.5" /><span className="hidden xs:inline">Export</span>
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 md:p-12 custom-scrollbar">
              <div className="max-w-3xl mx-auto">
                <h1 className="mb-6">{selectedPRD.title}</h1>
                <div className="whitespace-pre-wrap text-[16px] font-normal text-foreground leading-[1.6] selection:bg-primary/10 tracking-tight">
                  {selectedPRD.content}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 md:p-20 text-center h-full max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-muted/10 border border-border/40 flex items-center justify-center mb-6">
              <FileText className="h-8 w-8 text-muted-foreground/20" />
            </div>
            <p className="label-system text-[12px] mb-2 text-foreground">Workspace Empty</p>
            <p className="text-xs text-muted-foreground/60 leading-relaxed font-medium mb-8">
              Select an existing specification from the sidebar or generate a new one using your research notes.
            </p>
            <Button
              className="h-10 px-8 label-system text-[12px] bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/10 transition-all rounded-lg"
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

