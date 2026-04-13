"use client";

import { useAppStore } from "@/store/useAppStore";
import { Editor } from "@/components/editor/Editor";
import { AIPanel } from "@/components/ai/AIPanel";
import { SidebarNav } from "./SidebarNav";

export function Shell() {
  const { aiPanelOpen } = useAppStore();

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar: Fixed width */}
      <div className="w-[240px] shrink-0 xl:w-[260px] bg-sidebar relative z-20 shadow-sm">
        <SidebarNav />
      </div>
      
      {/* Center: Main Editor */}
      <div className="flex-1 min-w-0 bg-card overflow-hidden">
        <Editor />
      </div>
      
      {/* Right: AI Panel */}
      {aiPanelOpen && (
        <div className="w-[340px] shrink-0 xl:w-[380px] bg-sidebar border-l border-border relative z-20 shadow-xl overflow-hidden transition-all duration-300 ease-in-out">
          <AIPanel />
        </div>
      )}
    </div>
  );
}
