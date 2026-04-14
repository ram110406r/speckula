"use client";

import React, { useEffect } from "react";
import { TipTapEditor } from "./TipTapEditor";
import { useAppStore } from "@/store/useAppStore";
import { Sparkles, PanelRightOpen, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveDocument } from "@/lib/firebase/db";
import { useAuth } from "@/lib/firebase/AuthProvider";

export function Editor() {
  const { user } = useAuth();
  const { aiPanelOpen, toggleAiPanel, isSaving, currentDocId, documents, setDocuments } = useAppStore();
  const currentDoc = documents.find(d => d.id === currentDocId);

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

  return (
    <div className="flex h-full flex-col w-full bg-background selection:bg-primary/10">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border/60 h-14 px-8 shrink-0 bg-background">
        <div className="flex items-center gap-4 flex-1">
          <Input
            value={currentDoc?.title ?? "Untitled Document"}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="h-8 w-72 bg-transparent border-none focus-visible:ring-0 font-semibold text-base px-0 -ml-0.5 placeholder:text-muted-foreground/30"
            placeholder="Document Title..."
          />
          {isSaving && (
            <div className="flex items-center gap-2 px-2 py-0.5 rounded-md bg-muted/20 animate-pulse">
              <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
              <span className="label-system text-[12px] lowercase">
                Saving to Cloud
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 label-system text-[12px] hover:text-primary hover:bg-transparent px-2"
            onClick={toggleAiPanel}
          >
            {aiPanelOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
            {aiPanelOpen ? "Close Assistant" : "Focus Mode"}
          </Button>
          <div className="h-4 w-px bg-border/60 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 text-primary hover:bg-primary/5 p-0"
            onClick={toggleAiPanel}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 overflow-auto p-8 lg:p-12">
        <TipTapEditor />
      </div>
    </div>
  );
}

