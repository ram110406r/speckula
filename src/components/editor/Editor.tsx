"use client";

import React, { useEffect } from "react";
import { TipTapEditor } from "./TipTapEditor";
import { useAppStore } from "@/store/useAppStore";
import { PanelRightOpen, PanelRightClose, CircleDashed, ShieldAlert, FlaskConical, HelpCircle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveDocument } from "@/lib/firebase/db";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { URLImportBar } from "./URLImportBar";

const STRUCTURE_BLOCKS = [
  { id: "problem", label: "Problem", icon: CircleDashed, starter: "Problem: Who is struggling, what behavior is stuck, and what metric is moving the wrong way?" },
  { id: "hypothesis", label: "Hypothesis", icon: FlaskConical, starter: "Hypothesis: If we change ___ for ___ users, then ___ metric should improve because ___." },
  { id: "constraints", label: "Constraints", icon: ShieldAlert, starter: "Constraints: Timeline, team bandwidth, technical limits, and non-negotiables." },
  { id: "unknowns", label: "Unknowns", icon: HelpCircle, starter: "Unknowns: What assumptions are still unproven and what evidence is still missing?" },
] as const;

export function Editor() {
  const { user } = useAuth();
  const { aiPanelOpen, toggleAiPanel, isSaving, currentDocId, documents, setDocuments, activeContext, setPendingInsertion, setPendingImport } = useAppStore();
  const currentDoc = documents.find(d => d.id === currentDocId);
  const [showURLImport, setShowURLImport] = React.useState(false);

  const normalizedContext = activeContext.toLowerCase();
  const activeSectionId = normalizedContext.includes("hypothesis")
    ? "hypothesis"
    : normalizedContext.includes("constraint")
      ? "constraints"
      : normalizedContext.includes("unknown") || normalizedContext.includes("risk")
        ? "unknowns"
        : "problem";

  const isEmptyCanvas = activeContext.trim().length === 0;

  useEffect(() => {
    if (!user || !currentDocId || !currentDoc) return;

    const normalizedTitle = currentDoc.title.trim() || "Untitled Document";
    if (normalizedTitle === currentDoc.title.trim()) return;

    const handler = setTimeout(async () => {
      try {
        const title = normalizedTitle;
        await saveDocument(user.uid, currentDocId, { title });
        setDocuments(documents.map(d =>
          d.id === currentDocId ? { ...d, title } : d
        ));
      } catch (error) {
        console.error("Failed to save title:", error);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [currentDoc?.title, currentDocId, currentDoc, documents, setDocuments, user]);

  const handleTitleChange = (newTitle: string) => {
    if (!currentDocId) return;

    setDocuments(documents.map(d =>
      d.id === currentDocId ? { ...d, title: newTitle } : d
    ));
  };

  const insertStructuredStarter = (starter: string) => {
    setPendingInsertion(starter);
  };

  return (
    <div className="flex h-full flex-col w-full bg-card selection:bg-primary/10">
      <div className="border-b border-border/70 bg-card px-6 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <Input
            value={currentDoc?.title ?? "Untitled Document"}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="h-9 flex-1 max-w-[520px] rounded-md border-border/70 bg-transparent px-2 text-sm font-medium focus-visible:bg-background"
            placeholder="Document title"
          />
          {isSaving && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">Saving…</span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              title="Import from URL"
              aria-pressed={showURLImport}
              className={`h-8 gap-1.5 text-xs ${showURLImport ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setShowURLImport((prev) => !prev)}
            >
              <Link2 className="h-4 w-4" />
              Import URL
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={toggleAiPanel}
            >
              {aiPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              {aiPanelOpen ? "Hide assistant" : "Show assistant"}
            </Button>
          </div>
        </div>

        {isEmptyCanvas && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Start with:</span>
            {STRUCTURE_BLOCKS.map((block) => {
              const isActive = activeSectionId === block.id;
              const Icon = block.icon;
              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => insertStructuredStarter(block.starter)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${isActive ? "border-primary/40 bg-primary/5 text-primary" : "border-border/70 bg-background text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {block.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <URLImportBar
        visible={showURLImport}
        onImport={(text, title) => {
          setPendingImport({ text, title });
          setShowURLImport(false);
        }}
        onDismiss={() => setShowURLImport(false)}
      />

      {/* Editor Body */}
      <div className="relative flex-1 overflow-auto p-5 lg:p-8">
        <div className="mx-auto max-w-4xl rounded-xl border border-border/70 bg-background p-6 lg:p-8">
          <TipTapEditor />
        </div>
      </div>
    </div>
  );
}

