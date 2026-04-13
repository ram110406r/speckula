"use client";

import { TipTapEditor } from "./TipTapEditor";
import { useAppStore } from "@/store/useAppStore";
import { Sparkles, PanelRightOpen, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Editor() {
  const { aiPanelOpen, toggleAiPanel, isSaving } = useAppStore();

  return (
    <div className="flex h-full flex-col w-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border h-14 px-6 shrink-0 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">Untitled Document</span>
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
