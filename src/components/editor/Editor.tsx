"use client";

import React, { useState, useEffect } from "react";
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
  const [localTitle, setLocalTitle] = useState(currentDoc?.title || "Untitled Document");

  // Sync local title when switching documents
  useEffect(() => {
    if (currentDoc) {
      setLocalTitle(currentDoc.title);
    }
  }, [currentDocId, currentDoc]);

  const handleTitleChange = async (newTitle: string) => {
    setLocalTitle(newTitle);
    if (!user || !currentDocId) return;

    // Save to Firestore
    try {
      await saveDocument(user.uid, currentDocId, { title: newTitle });
      // Update local store list to reflect change in sidebar immediately
      setDocuments(documents.map(d => 
        d.id === currentDocId ? { ...d, title: newTitle } : d
      ));
    } catch (error) {
      console.error("Failed to save title:", error);
    }
  };

  return (
    <div className="flex h-full flex-col w-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border h-14 px-6 shrink-0 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 flex-1">
          <Input
            value={localTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="h-8 w-64 bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary/20 font-medium text-sm px-2 -ml-2"
            placeholder="Document Title..."
          />
          {isSaving && (
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full animate-pulse font-medium tracking-wide">
              Saving...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={toggleAiPanel}
          >
            {aiPanelOpen ? (
              <PanelRightClose className="h-3.5 w-3.5" />
            ) : (
              <PanelRightOpen className="h-3.5 w-3.5" />
            )}
            {aiPanelOpen ? "Hide AI" : "Show AI"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary hover:bg-primary/10"
            onClick={toggleAiPanel}
            title="Open AI Assistant"
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

